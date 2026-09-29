import pb from '@/lib/pocketbase/client'

export interface MagaluStatusResponse {
  ok: boolean
  configured: boolean
  connected: boolean
  client_id?: string
  client_secret_configured?: boolean
  redirect_uri?: string
  seller_id?: string | null
  seller_name?: string | null
  token_expires_at?: string | null
  scopes?: string | null
  channel_id?: string
  branch_id?: string
  environment?: 'production' | 'sandbox'
  status: 'disconnected' | 'configured' | 'connected'
  error?: string
}

export interface MagaluItem {
  id: string
  sku: string
  title: string
  price: number
  list_price?: number
  available_quantity: number
  status: 'active' | 'paused' | 'closed' | string
  condition?: string
  brand?: string
  model?: string
  category_id?: string
  permalink?: string
  thumbnail?: string
  raw_item?: Record<string, unknown>
}

export interface MagaluOrderItem {
  sku: string
  name: string
  quantity: number
  unit_price: number
  list_price?: number
}

export interface MagaluOrder {
  id: string
  order_id: string
  order_code?: string
  date_created: string
  date_updated?: string
  status: 'pending' | 'approved' | 'invoiced' | 'shipped' | 'delivered' | 'cancelled' | string
  total_amount: number
  currency?: string
  buyer_name?: string
  buyer_document?: string
  shipping_status?: string
  carrier_name?: string
  tracking_url?: string
  items?: MagaluOrderItem[]
  raw_order?: Record<string, unknown>
}

export interface SaveMagaluCredentialsInput {
  client_id: string
  client_secret?: string
  redirect_uri?: string
  channel_id?: string
  branch_id?: string
  environment?: 'production' | 'sandbox'
  seller_name?: string
  seller_id?: string
}

export interface UpdateMagaluItemInput {
  sku: string
  product_id?: string
  new_price?: number
  new_list_price?: number
  new_quantity?: number
  action: 'update_price' | 'update_stock' | 'update_price_stock' | 'pause' | 'activate'
}

class MagaluService {
  /**
   * Obtém status da conexão do Magalu Marketplace sem expor client_secret.
   */
  async getStatus(): Promise<MagaluStatusResponse> {
    try {
      const res = await pb.send<MagaluStatusResponse>('/backend/v1/magalu/status', {
        method: 'GET',
      })
      return res
    } catch (err: unknown) {
      // Fallback para ler registro direto se rota custom falhar
      try {
        const records = await pb.collection('magalu_settings').getList(1, 1, {
          sort: '-created',
        })
        if (records.items.length === 0) {
          return {
            ok: true,
            configured: false,
            connected: false,
            status: 'disconnected',
            channel_id: '9fe0d853-732b-4e4a-a0b0-cff988ed043d',
            environment: 'production',
          }
        }
        const rec = records.items[0]
        const hasSecret = Boolean(rec.client_secret)
        const hasToken = Boolean(rec.access_token)
        return {
          ok: true,
          configured: Boolean(rec.client_id && hasSecret),
          connected: Boolean(hasToken),
          client_id: rec.client_id,
          client_secret_configured: hasSecret,
          redirect_uri: rec.redirect_uri,
          seller_id: rec.seller_id,
          seller_name: rec.seller_name,
          token_expires_at: rec.token_expires_at,
          scopes: rec.scopes,
          channel_id: rec.channel_id || '9fe0d853-732b-4e4a-a0b0-cff988ed043d',
          branch_id: rec.branch_id || '',
          environment: rec.environment || 'production',
          status: hasToken ? 'connected' : hasSecret ? 'configured' : 'disconnected',
        }
      } catch (fallbackErr) {
        return {
          ok: false,
          configured: false,
          connected: false,
          status: 'disconnected',
          error: String(err || fallbackErr),
        }
      }
    }
  }

  /**
   * Salva credenciais do seller Magalu no PocketBase.
   */
  async saveCredentials(input: SaveMagaluCredentialsInput): Promise<boolean> {
    const list = await pb.collection('magalu_settings').getList(1, 1, {
      sort: '-created',
    })

    const payload: Record<string, unknown> = {
      client_id: input.client_id.trim(),
      redirect_uri:
        input.redirect_uri?.trim() ||
        'https://controle-de-lotes-de-equipamentos-25024.goskip.app/configuracoes',
      channel_id: input.channel_id?.trim() || '9fe0d853-732b-4e4a-a0b0-cff988ed043d',
      branch_id: input.branch_id?.trim() || '',
      environment: input.environment || 'production',
    }

    if (input.client_secret && input.client_secret.trim()) {
      payload.client_secret = input.client_secret.trim()
    }
    if (input.seller_name) payload.seller_name = input.seller_name.trim()
    if (input.seller_id) payload.seller_id = input.seller_id.trim()

    if (list.items.length > 0) {
      await pb.collection('magalu_settings').update(list.items[0].id, payload)
    } else {
      await pb.collection('magalu_settings').create(payload)
    }

    return true
  }

  /**
   * Dispara a troca assíncrona de code retornado pelo OAuth ID Magalu por tokens.
   */
  async exchangeOAuthCode(
    code: string,
    redirectUri?: string,
  ): Promise<{ success: boolean; error?: string }> {
    const req = await pb.collection('magalu_oauth_requests').create({
      code: code.trim(),
      redirect_uri:
        redirectUri || 'https://controle-de-lotes-de-equipamentos-25024.goskip.app/configuracoes',
      status: 'pending',
      requested_by: pb.authStore.record?.id || null,
    })

    // Aguarda resolução do hook assíncrono (polling de até 15s)
    const startTime = Date.now()
    while (Date.now() - startTime < 15000) {
      await new Promise((r) => setTimeout(r, 1000))
      const updated = await pb.collection('magalu_oauth_requests').getOne(req.id)
      if (updated.status === 'done') {
        return { success: true }
      }
      if (updated.status === 'error') {
        return {
          success: false,
          error: updated.error_message || 'Falha na troca de código Magalu.',
        }
      }
    }

    return {
      success: false,
      error:
        'Tempo esgotado aguardando autorização da API Magalu. Verifique o status da conexão em alguns instantes.',
    }
  }

  /**
   * Constrói o link oficial de autorização OAuth do Magalu
   */
  getOAuthAuthorizationUrl(clientId: string, redirectUri: string): string {
    const scopes = [
      'open:portfolio-skus:read',
      'open:portfolio-prices-seller:write',
      'open:portfolio-stocks-seller:write',
      'open:orders:read',
      'open:deliveries:read',
    ].join(' ')

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scopes,
    })

    return `https://id.magalu.com/oauth/authorize?${params.toString()}`
  }

  /**
   * Desconecta a integração (limpa tokens e seller_id)
   */
  async disconnect(): Promise<void> {
    const list = await pb.collection('magalu_settings').getList(1, 1, {
      sort: '-created',
    })
    if (list.items.length > 0) {
      await pb.collection('magalu_settings').update(list.items[0].id, {
        access_token: '',
        refresh_token: '',
        token_expires_at: null,
        seller_id: null,
        seller_name: null,
      })
    }
  }

  /**
   * Busca anúncios/produtos do Seller na Open API Magalu de forma resiliente via job worker
   */
  async fetchItems(options?: {
    forceRefresh?: boolean
    limit?: number
    onProgress?: (text: string) => void
  }): Promise<{ items: MagaluItem[]; error?: string }> {
    // 1. Se forceRefresh for false, tenta ler o último job com sucesso (< 10 minutos)
    if (!options?.forceRefresh) {
      try {
        const lastJobs = await pb.collection('magalu_ads_fetch_jobs').getList(1, 1, {
          filter: 'status = "done"',
          sort: '-created',
        })
        if (lastJobs.items.length > 0) {
          const job = lastJobs.items[0]
          const jobTime = new Date(job.created).getTime()
          if (Date.now() - jobTime < 10 * 60 * 1000 && Array.isArray(job.items)) {
            return { items: job.items as MagaluItem[] }
          }
        }
      } catch {
        /* intentionally ignored */
      }
    }

    // 2. Dispara novo job assíncrono
    const newJob = await pb.collection('magalu_ads_fetch_jobs').create({
      status: 'pending',
      limit: options?.limit || 100,
      progress_text: 'Iniciando sincronização com Magalu...',
      requested_by: pb.authStore.record?.id || null,
    })

    const startTime = Date.now()
    while (Date.now() - startTime < 35000) {
      await new Promise((r) => setTimeout(r, 1200))
      try {
        const updated = await pb.collection('magalu_ads_fetch_jobs').getOne(newJob.id)
        if (options?.onProgress && updated.progress_text) {
          options.onProgress(updated.progress_text)
        }
        if (updated.status === 'done') {
          return { items: (updated.items || []) as MagaluItem[] }
        }
        if (updated.status === 'error') {
          return {
            items: [],
            error: updated.error_message || 'Erro ao sincronizar produtos com a API Magalu.',
          }
        }
      } catch (pollErr) {
        console.warn('Erro no polling do job Magalu:', pollErr)
      }
    }

    return {
      items: [],
      error:
        'Tempo esgotado aguardando resposta da Open API do Magalu. Tente novamente em instantes.',
    }
  }

  /**
   * Enfileira alteração atômica de preço e/ou estoque para um SKU Magalu
   */
  async updateItem(input: UpdateMagaluItemInput): Promise<{ success: boolean; error?: string }> {
    const queueRecord = await pb.collection('magalu_item_queue').create({
      sku: input.sku.trim(),
      product_id: input.product_id || '',
      action: input.action,
      new_price: input.new_price !== undefined ? Number(input.new_price) : null,
      new_list_price: input.new_list_price !== undefined ? Number(input.new_list_price) : null,
      new_quantity: input.new_quantity !== undefined ? Number(input.new_quantity) : null,
      status: 'pending',
      requested_by: pb.authStore.record?.id || null,
    })

    // Aguarda execução do hook worker
    const startTime = Date.now()
    while (Date.now() - startTime < 20000) {
      await new Promise((r) => setTimeout(r, 800))
      try {
        const updated = await pb.collection('magalu_item_queue').getOne(queueRecord.id)
        if (updated.status === 'done') {
          return { success: true }
        }
        if (updated.status === 'error') {
          return {
            success: false,
            error: updated.error_message || 'Falha ao processar atualização no Magalu.',
          }
        }
      } catch {
        /* intentionally ignored */
      }
    }

    return {
      success: false,
      error:
        'A operação foi enfileirada, mas a resposta da Open API Magalu está demorando. O status será atualizado em instantes.',
    }
  }

  /**
   * Atualização em massa de preços para ofertas Magalu
   */
  async bulkUpdatePrices(
    updates: Array<{ sku: string; price: number; list_price?: number }>,
    onProgress?: (current: number, total: number) => void,
  ): Promise<{ successCount: number; errors: Array<{ sku: string; error: string }> }> {
    let successCount = 0
    const errors: Array<{ sku: string; error: string }> = []

    for (let i = 0; i < updates.length; i++) {
      const item = updates[i]
      if (onProgress) onProgress(i + 1, updates.length)

      const res = await this.updateItem({
        sku: item.sku,
        new_price: item.price,
        new_list_price: item.list_price,
        action: 'update_price',
      })

      if (res.success) {
        successCount++
      } else {
        errors.push({
          sku: item.sku,
          error: res.error || 'Erro desconhecido',
        })
      }
    }

    return { successCount, errors }
  }

  /**
   * Atualização em massa de estoque para ofertas Magalu
   */
  async bulkUpdateStock(
    updates: Array<{ sku: string; quantity: number }>,
    onProgress?: (current: number, total: number) => void,
  ): Promise<{ successCount: number; errors: Array<{ sku: string; error: string }> }> {
    let successCount = 0
    const errors: Array<{ sku: string; error: string }> = []

    for (let i = 0; i < updates.length; i++) {
      const item = updates[i]
      if (onProgress) onProgress(i + 1, updates.length)

      const res = await this.updateItem({
        sku: item.sku,
        new_quantity: item.quantity,
        action: 'update_stock',
      })

      if (res.success) {
        successCount++
      } else {
        errors.push({
          sku: item.sku,
          error: res.error || 'Erro desconhecido',
        })
      }
    }

    return { successCount, errors }
  }

  /**
   * Busca lista de pedidos salvos localmente
   */
  async getLocalOrders(options?: {
    page?: number
    perPage?: number
    status?: string
    search?: string
  }): Promise<{ items: MagaluOrder[]; totalItems: number }> {
    const page = options?.page || 1
    const perPage = options?.perPage || 50

    const filters: string[] = []
    if (options?.status && options.status !== 'all') {
      filters.push(`status = "${options.status}"`)
    }
    if (options?.search && options.search.trim()) {
      const q = options.search.trim().replace(/"/g, '\\"')
      filters.push(`(order_id ~ "${q}" || order_code ~ "${q}" || buyer_name ~ "${q}")`)
    }

    const filterString = filters.length > 0 ? filters.join(' && ') : ''

    const res = await pb.collection('magalu_orders').getList(page, perPage, {
      filter: filterString,
      sort: '-date_created',
    })

    const items: MagaluOrder[] = res.items.map((r) => ({
      id: r.id,
      order_id: r.order_id,
      order_code: r.order_code,
      date_created: r.date_created,
      date_updated: r.date_updated,
      status: r.status,
      total_amount: r.total_amount,
      currency: r.currency,
      buyer_name: r.buyer_name,
      buyer_document: r.buyer_document,
      shipping_status: r.shipping_status,
      carrier_name: r.carrier_name,
      tracking_url: r.tracking_url,
      items: (r.items as MagaluOrderItem[]) || [],
      raw_order: r.raw_order as Record<string, unknown>,
    }))

    return { items, totalItems: res.totalItems }
  }

  /**
   * Sincroniza pedidos recentes do Magalu criando um job de sincronização
   */
  async syncOrders(options?: {
    daysBack?: number
    onProgress?: (text: string) => void
  }): Promise<{ fetched: number; saved: number; error?: string }> {
    const job = await pb.collection('magalu_orders_sync_jobs').create({
      status: 'pending',
      days_back: options?.daysBack || 30,
      progress_text: 'Iniciando sincronização de pedidos Magalu...',
      requested_by: pb.authStore.record?.id || null,
    })

    const startTime = Date.now()
    while (Date.now() - startTime < 35000) {
      await new Promise((r) => setTimeout(r, 1200))
      try {
        const updated = await pb.collection('magalu_orders_sync_jobs').getOne(job.id)
        if (options?.onProgress && updated.progress_text) {
          options.onProgress(updated.progress_text)
        }
        if (updated.status === 'done') {
          return {
            fetched: updated.orders_fetched || 0,
            saved: updated.orders_saved || 0,
          }
        }
        if (updated.status === 'error') {
          return {
            fetched: 0,
            saved: 0,
            error: updated.error_message || 'Erro ao sincronizar pedidos do Magalu.',
          }
        }
      } catch (pollErr) {
        console.warn('Erro no polling do job de pedidos Magalu:', pollErr)
      }
    }

    return {
      fetched: 0,
      saved: 0,
      error: 'Tempo esgotado aguardando resposta de pedidos da API Magalu.',
    }
  }
}

export const magaluService = new MagaluService()
