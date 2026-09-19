import pb from '@/lib/pocketbase/client'
import { getActiveTenantId } from './mlService'

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
  shipping_handling_limit?: string | null
  shipping_date_shipped?: string | null
  shipping_date_delivered?: string | null
  shipping_delayed?: boolean
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

export interface MLReputationRisk {
  totalSalesInWindow: number
  delayedSalesCount: number
  delayedRatePercent: number
  maxAllowedRatePercent: number // 10%
  windowDescription: string
  claimsCount: number
  isAtRisk: boolean
  riskLevel: 'safe' | 'warning' | 'danger'
}

export interface MLDeadlinesKPIs {
  totalToScanToday: number
  totalDelayed: number
  totalInvoicePending: number
  totalOnTime: number
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

      // Resolver status de envio efetivo:
      // Status enriquecido do banco (API oficial de shipments) tem autoridade absoluta sobre tags.
      // Tags servem estritamente como fallback quando shipping_status é indefinido ou pending.
      const tags = Array.isArray(order.tags) ? order.tags : []
      const hasNotDelivered = tags.includes('not_delivered')
      const hasDelivered = tags.includes('delivered')
      const hasShipped = tags.includes('shipped')

      let effShippingStatus = order.shipping_status || 'pending'
      if (order.shipping_status && order.shipping_status !== 'pending') {
        effShippingStatus = order.shipping_status
      } else {
        if (hasNotDelivered && !hasDelivered) {
          effShippingStatus = 'pending'
        } else if (hasDelivered) {
          effShippingStatus = 'delivered'
        } else if (hasShipped) {
          effShippingStatus = 'shipped'
        }
      }

      const isDelivered = effShippingStatus === 'delivered'
      const isShipped = effShippingStatus === 'shipped'

      if (
        !isDelivered &&
        !isShipped &&
        (effShippingStatus === 'ready_to_ship' ||
          effShippingStatus === 'pending' ||
          effShippingStatus === 'to_be_agreed')
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
   * Calcula o risco de reputação do Mercado Livre baseado na régua oficial dos 10%
   * Janela: 3 meses anteriores + mês atual (ou últimos 5 anos se volume < 50 vendas).
   */
  calculateReputationRisk(orders: MLOrder[]): MLReputationRisk {
    const now = new Date()
    // Início da janela de 3 meses + mês atual: primeiro dia do mês correspondente a 3 meses atrás
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() // 0-indexed
    const startOfThreeMonthsAgo = new Date(currentYear, currentMonth - 3, 1).getTime()

    // Filtrar pedidos válidos na janela de 3 meses + mês atual
    const ordersIn3mWindow = orders.filter((o) => {
      if (o.status === 'cancelled') return false
      const dt = new Date(o.date_created).getTime()
      return dt >= startOfThreeMonthsAgo
    })

    let windowOrders = ordersIn3mWindow
    let windowDescription = 'Últimos 3 meses + mês atual'

    // Se tiver menos de 50 vendas, a régua oficial do ML estende para 5 anos
    if (ordersIn3mWindow.length < 50) {
      const fiveYearsAgo = new Date(currentYear - 5, currentMonth, 1).getTime()
      windowOrders = orders.filter((o) => {
        if (o.status === 'cancelled') return false
        const dt = new Date(o.date_created).getTime()
        return dt >= fiveYearsAgo
      })
      windowDescription = 'Últimos 5 anos (< 50 vendas recentes)'
    }

    let delayedSalesCount = 0
    let claimsCount = 0

    for (const o of windowOrders) {
      if (o.shipping_delayed) {
        delayedSalesCount++
      } else {
        // Fallback: se tiver date_shipped e shipping_handling_limit, calcula com ajuste de fim de semana
        if (o.shipping_handling_limit && o.shipping_date_shipped) {
          const originalLimit = new Date(o.shipping_handling_limit)
          const shippedDate = new Date(o.shipping_date_shipped)

          // Desloca fim de semana (sábado/domingo) para a segunda-feira seguinte
          const dayOfWeek = originalLimit.getDay()
          let daysToAdd = 0
          if (dayOfWeek === 6)
            daysToAdd = 2 // Sábado -> Segunda
          else if (dayOfWeek === 0) daysToAdd = 1 // Domingo -> Segunda

          const adjustedLimitMs = originalLimit.getTime() + daysToAdd * 24 * 60 * 60 * 1000
          if (shippedDate.getTime() - adjustedLimitMs > 60000) {
            delayedSalesCount++
          }
        }
      }

      // Reclamações se disponíveis nas tags ou feedback
      const tags = Array.isArray(o.tags) ? o.tags : []
      if (
        tags.includes('claim') ||
        tags.includes('complaint') ||
        tags.includes('has_claim') ||
        (o.feedback && (o.feedback.rating === 'negative' || o.feedback.status === 'has_claim'))
      ) {
        claimsCount++
      }
    }

    const totalSales = windowOrders.length
    const delayedRatePercent = totalSales > 0 ? (delayedSalesCount / totalSales) * 100 : 0
    const maxAllowedRatePercent = 10

    let riskLevel: 'safe' | 'warning' | 'danger' = 'safe'
    if (delayedRatePercent >= 10) {
      riskLevel = 'danger'
    } else if (delayedRatePercent >= 7) {
      riskLevel = 'warning'
    }

    return {
      totalSalesInWindow: totalSales,
      delayedSalesCount,
      delayedRatePercent,
      maxAllowedRatePercent,
      windowDescription,
      claimsCount,
      isAtRisk: delayedRatePercent >= 10,
      riskLevel,
    }
  },

  /**
   * Calcula os KPIs de envios e prazos
   */
  calculateDeadlinesKPIs(orders: MLOrder[]): MLDeadlinesKPIs {
    const now = new Date()
    const nowMs = now.getTime()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const endOfToday = startOfToday + 24 * 60 * 60 * 1000 - 1

    let totalToScanToday = 0
    let totalDelayed = 0
    let totalInvoicePending = 0
    let totalOnTime = 0

    for (const o of orders) {
      if (o.status === 'cancelled') continue

      const effShipStatus = (o.shipping_status || '').toLowerCase()
      const effSubstatus = (o.shipping_substatus || '').toLowerCase()
      const isShipped = effShipStatus === 'shipped' || effShipStatus === 'delivered'

      if (effSubstatus === 'invoice_pending') {
        totalInvoicePending++
      }

      // Pedidos pendentes de despacho/bip:
      // status ready_to_ship (substatus in_hub, in_packing_list, buffered) ou pending com NF ok
      const isPendingScan =
        !isShipped &&
        (effShipStatus === 'ready_to_ship' || effShipStatus === 'pending') &&
        effSubstatus !== 'invoice_pending'

      if (isPendingScan) {
        if (o.shipping_handling_limit) {
          const originalLimit = new Date(o.shipping_handling_limit)
          const dayOfWeek = originalLimit.getDay()
          let daysToAdd = 0
          if (dayOfWeek === 6)
            daysToAdd = 2 // Sábado -> Segunda
          else if (dayOfWeek === 0) daysToAdd = 1 // Domingo -> Segunda

          const adjustedLimitMs = originalLimit.getTime() + daysToAdd * 24 * 60 * 60 * 1000
          const nowDayOfWeek = now.getDay()
          const isWeekendNow = nowDayOfWeek === 0 || nowDayOfWeek === 6

          // Fim de semana NÃO marca atraso no semáforo
          if (!isWeekendNow && nowMs > adjustedLimitMs) {
            totalDelayed++
          } else {
            totalOnTime++
          }

          if (adjustedLimitMs >= startOfToday && adjustedLimitMs <= endOfToday) {
            totalToScanToday++
          }
        } else {
          totalToScanToday++
        }
      } else if (isShipped) {
        if (o.shipping_delayed) {
          totalDelayed++
        } else if (o.shipping_handling_limit && o.shipping_date_shipped) {
          const originalLimit = new Date(o.shipping_handling_limit)
          const shippedDate = new Date(o.shipping_date_shipped)
          const dayOfWeek = originalLimit.getDay()
          let daysToAdd = 0
          if (dayOfWeek === 6) daysToAdd = 2
          else if (dayOfWeek === 0) daysToAdd = 1
          const adjustedLimitMs = originalLimit.getTime() + daysToAdd * 24 * 60 * 60 * 1000
          if (shippedDate.getTime() - adjustedLimitMs > 60000) {
            totalDelayed++
          }
        }
      }
    }

    return {
      totalToScanToday,
      totalDelayed,
      totalInvoicePending,
      totalOnTime,
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

    const activeTenantId = getActiveTenantId()
    const job = await pb.collection('ml_orders_sync_jobs').create({
      status: 'pending',
      days_back: daysBack,
      tenant_id: activeTenantId || undefined,
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

  /**
   * Busca dados fiscais (CPF/CNPJ e nome) na API oficial do Mercado Livre
   * e sincroniza automaticamente com o pedido e ml_customers
   */
  async lookupFiscalData(orderId: string): Promise<{
    ok: boolean
    found: boolean
    order_id: string
    document: string
    buyer_name: string
    source: string
    message: string
  }> {
    const token = pb.authStore.token
    const headers: Record<string, string> = {}
    if (token) {
      headers.Authorization = token
    }

    const res = await pb.send<{
      ok: boolean
      found: boolean
      order_id: string
      document: string
      buyer_name: string
      source: string
      message: string
    }>(`/backend/v1/ml/orders/${encodeURIComponent(orderId)}/fiscal-lookup`, {
      method: 'POST',
      headers,
    })
    return res
  },

  /**
   * Atualização rápida dos dados fiscais do comprador (CPF/CNPJ + Nome)
   * Salva no pedido ml_orders E faz upsert no cadastro ml_customers
   */
  async updateOrderFiscalData(
    orderRecordId: string,
    data: {
      buyer_document: string
      buyer_name?: string
      buyer_id?: string
      buyer_nickname?: string
    },
  ): Promise<MLOrder> {
    const cleanDoc = data.buyer_document.replace(/\D/g, '')

    // 1. Atualizar ml_orders
    const updatedOrder = await pb.collection('ml_orders').update<MLOrder>(orderRecordId, {
      buyer_document: cleanDoc,
      ...(data.buyer_name?.trim() ? { buyer_name: data.buyer_name.trim() } : {}),
    })

    // 2. Upsert no ml_customers
    try {
      let cust = null
      if (data.buyer_id) {
        try {
          cust = await pb
            .collection('ml_customers')
            .getFirstListItem(`buyer_id = "${data.buyer_id}"`, { requestKey: null })
        } catch {
          /* intentionally ignored */
        }
      }
      if (!cust && data.buyer_nickname) {
        try {
          cust = await pb
            .collection('ml_customers')
            .getFirstListItem(`nickname = "${data.buyer_nickname.replace(/"/g, '\\"')}"`, {
              requestKey: null,
            })
        } catch {
          /* intentionally ignored */
        }
      }

      const finalName =
        data.buyer_name?.trim() ||
        cust?.name ||
        data.buyer_nickname ||
        'Cliente ML ' + (data.buyer_id || '')

      if (cust) {
        await pb.collection('ml_customers').update(cust.id, {
          document: cleanDoc,
          name: finalName,
        })
      } else if (data.buyer_id || data.buyer_nickname) {
        await pb.collection('ml_customers').create({
          buyer_id: data.buyer_id || '',
          nickname: data.buyer_nickname || '',
          name: finalName,
          document: cleanDoc,
          origin: 'ml',
          tags: ['ml'],
        })
      }
    } catch (cErr) {
      console.error('Erro ao atualizar ml_customers na edição rápida:', cErr)
    }

    return updatedOrder
  },
}
