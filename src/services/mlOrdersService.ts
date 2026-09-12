import pb from '@/lib/pocketbase/client'

export interface MLOrderItem {
  item_id: string
  title: string
  category_id?: string
  variation_id?: string | null
  seller_sku?: string
  quantity: number
  unit_price: number
  full_unit_price?: number
  currency_id?: string
}

export interface MLOrderPayment {
  id: string
  payment_method_id?: string
  payment_type?: string
  status: string
  status_detail?: string
  transaction_amount: number
  date_approved?: string | null
}

export interface MLOrder {
  id: string
  order_id: string
  date_created: string
  date_closed?: string | null
  status: 'paid' | 'cancelled' | 'confirmed' | 'payment_required' | string
  status_detail?: string
  total_amount: number
  currency_id: string
  buyer_id?: string
  buyer_nickname?: string
  buyer_name?: string
  buyer_document?: string
  shipping_id?: string
  shipping_status:
    | 'to_be_agreed'
    | 'pending'
    | 'ready_to_ship'
    | 'shipped'
    | 'delivered'
    | 'not_delivered'
    | 'cancelled'
    | string
  shipping_substatus?: string
  shipping_mode?: string
  receiver_address?: {
    street_name?: string
    street_number?: string
    city?: { name: string }
    state?: { name: string }
    zip_code?: string
  } | null
  items: MLOrderItem[]
  payments: MLOrderPayment[]
  tags?: string[]
  feedback?: any
  raw_order?: any
  created: string
  updated: string
}

export interface MLOrderKPIs {
  faturamentoHoje: number
  pedidosHoje: number
  faturamento7dias: number
  pedidos7dias: number
  faturamento30dias: number
  pedidos30dias: number
  ticketMedio30dias: number
  pedidosProntosEnvio: number
  pedidosEntregues30dias: number
}

export const mlOrdersService = {
  /**
   * Lista os pedidos salvos na coleção ml_orders com ordenação por data decrescente
   */
  async getOrders(options?: {
    status?: string
    shipping_status?: string
    search?: string
    page?: number
    perPage?: number
  }): Promise<{ items: MLOrder[]; totalItems: number }> {
    const page = options?.page || 1
    const perPage = options?.perPage || 100

    const filters: string[] = []
    if (options?.status && options.status !== 'all') {
      filters.push(`status = "${options.status}"`)
    }
    if (options?.shipping_status && options.shipping_status !== 'all') {
      filters.push(`shipping_status = "${options.shipping_status}"`)
    }
    if (options?.search?.trim()) {
      const q = options.search.trim().replace(/["\\]/g, '')
      filters.push(`(order_id ~ "${q}" || buyer_nickname ~ "${q}" || buyer_name ~ "${q}")`)
    }

    const filterStr = filters.join(' && ')

    try {
      const res = await pb.collection('ml_orders').getList<MLOrder>(page, perPage, {
        sort: '-date_created',
        filter: filterStr || undefined,
        requestKey: null,
      })
      return {
        items: res.items,
        totalItems: res.totalItems,
      }
    } catch (err) {
      console.error('Erro ao listar ml_orders:', err)
      return { items: [], totalItems: 0 }
    }
  },

  /**
   * Calcula métricas e KPIs consolidados de faturamento e volume (hoje, 7 dias, 30 dias)
   */
  calculateKPIs(orders: MLOrder[]): MLOrderKPIs {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000
    const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000

    let faturamentoHoje = 0
    let pedidosHoje = 0
    let faturamento7dias = 0
    let pedidos7dias = 0
    let faturamento30dias = 0
    let pedidos30dias = 0
    let pedidosProntosEnvio = 0
    let pedidosEntregues30dias = 0

    for (const order of orders) {
      const orderTime = new Date(order.date_created).getTime()
      const isPaid = order.status === 'paid' || order.status === 'confirmed'
      const amount = Number(order.total_amount) || 0

      // Envio pronto para despachar (somente se não foi cancelado nem entregue nem enviado)
      const tags = Array.isArray(order.tags) ? order.tags : []
      const hasNotDelivered = tags.includes('not_delivered')
      const hasDelivered = tags.includes('delivered')
      const hasShipped = tags.includes('shipped')

      const isDelivered =
        !hasNotDelivered && (order.shipping_status === 'delivered' || hasDelivered)
      const isShipped = !hasNotDelivered && (order.shipping_status === 'shipped' || hasShipped)

      if (
        !isDelivered &&
        !isShipped &&
        (order.shipping_status === 'ready_to_ship' ||
          order.shipping_status === 'pending' ||
          order.shipping_status === 'to_be_agreed')
      ) {
        if (order.status !== 'cancelled') {
          pedidosProntosEnvio++
        }
      }

      if (orderTime >= thirtyDaysAgo) {
        if (isPaid) {
          faturamento30dias += amount
          pedidos30dias++
          if (isDelivered) {
            pedidosEntregues30dias++
          }
        }

        if (orderTime >= sevenDaysAgo && isPaid) {
          faturamento7dias += amount
          pedidos7dias++
        }

        if (orderTime >= startOfToday && isPaid) {
          faturamentoHoje += amount
          pedidosHoje++
        }
      }
    }

    const ticketMedio30dias = pedidos30dias > 0 ? faturamento30dias / pedidos30dias : 0

    return {
      faturamentoHoje,
      pedidosHoje,
      faturamento7dias,
      pedidos7dias,
      faturamento30dias,
      pedidos30dias,
      ticketMedio30dias,
      pedidosProntosEnvio,
      pedidosEntregues30dias,
    }
  },

  /**
   * Dispara sincronização de pedidos via fila ml_orders_sync_jobs com polling seguro
   */
  async syncOrders(options?: {
    daysBack?: number
    onProgress?: (message: string) => void
  }): Promise<{ success: boolean; ordersFetched: number; ordersSaved: number; message: string }> {
    const daysBack = options?.daysBack || 180
    const onProgress = options?.onProgress

    if (onProgress) {
      onProgress('Criando solicitação de sincronização de pedidos no servidor...')
    }

    const job = await pb.collection('ml_orders_sync_jobs').create({
      status: 'pending',
      days_back: daysBack,
      requested_by: pb.authStore.record?.id || pb.authStore.model?.id || null,
    })

    const jobId = job.id
    const timeoutMs = 90_000
    const intervalMs = 1_000
    const start = Date.now()

    while (Date.now() - start < timeoutMs) {
      await new Promise((r) => setTimeout(r, intervalMs))

      try {
        const current = await pb.collection('ml_orders_sync_jobs').getOne(jobId)

        if (current.progress_text && onProgress) {
          onProgress(current.progress_text)
        }

        if (current.status === 'done') {
          return {
            success: true,
            ordersFetched: current.orders_fetched || 0,
            ordersSaved: current.orders_saved || 0,
            message: current.progress_text || 'Pedidos sincronizados com sucesso.',
          }
        }

        if (current.status === 'error') {
          throw new Error(
            current.error_message || 'Falha ao sincronizar pedidos com o Mercado Livre.',
          )
        }
      } catch (err: any) {
        if (err.message && !err.status) {
          throw err
        }
      }
    }

    throw new Error('Tempo limite excedido ao aguardar sincronização de pedidos no servidor.')
  },
}
