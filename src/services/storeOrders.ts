import pb from '@/lib/pocketbase/client'
import type { StoreOrder, StoreOrderStatus, MercadoPagoSettings } from '@/types/inventory'

export interface CreateStoreOrderInput {
  product_id: string
  batch_id?: string
  quantity: number
  unit_price: number
  total_amount?: number
  customer_name: string
  customer_phone: string
  customer_email?: string
  customer_document?: string
  origin?: 'loja' | 'whatsapp'
  notes?: string
}

export interface MPTestConnectionResponse {
  ok: boolean
  configured: boolean
  message: string
  status_code?: number
  data?: {
    id?: number
    nickname?: string
    first_name?: string
    last_name?: string
    email?: string
    site_id?: string
    user_type?: string
    points?: number
  }
}

export interface MPPublicConfigResponse {
  enabled: boolean
  public_key: string
  store_title: string
}

export interface MPCreatePreferenceResponse {
  ok: boolean
  preference_id?: string
  init_point?: string
  sandbox_init_point?: string
  order_id?: string
  fallback_to_whatsapp?: boolean
  error?: string
}

export const storeOrdersService = {
  /**
   * Buscar todos os pedidos da loja (admin)
   */
  async getAll(): Promise<StoreOrder[]> {
    return await pb.collection('store_orders').getFullList<StoreOrder>({
      expand: 'product_id,batch_id',
      sort: '-created',
    })
  },

  /**
   * Buscar um pedido específico por ID (público ou admin)
   */
  async getById(id: string): Promise<StoreOrder> {
    return await pb.collection('store_orders').getOne<StoreOrder>(id, {
      expand: 'product_id,batch_id',
    })
  },

  /**
   * Criar um novo pedido da loja pública
   */
  async create(input: CreateStoreOrderInput): Promise<StoreOrder> {
    const totalAmount =
      input.total_amount !== undefined ? input.total_amount : input.quantity * input.unit_price

    return await pb.collection('store_orders').create<StoreOrder>({
      product_id: input.product_id,
      batch_id: input.batch_id || '',
      quantity: input.quantity || 1,
      unit_price: input.unit_price,
      total_amount: totalAmount,
      customer_name: input.customer_name.trim(),
      customer_phone: input.customer_phone.trim(),
      customer_email: (input.customer_email || '').trim(),
      customer_document: (input.customer_document || '').trim(),
      status: 'pendente',
      origin: input.origin || 'loja',
      notes: input.notes || '',
      stock_decremented: false,
    })
  },

  /**
   * Atualizar status do pedido manualmente (admin)
   */
  async updateStatus(id: string, status: StoreOrderStatus, notes?: string): Promise<StoreOrder> {
    const payload: Record<string, any> = { status }
    if (notes !== undefined) {
      payload.notes = notes
    }
    return await pb.collection('store_orders').update<StoreOrder>(id, payload)
  },

  /**
   * Excluir pedido (admin)
   */
  async delete(id: string): Promise<boolean> {
    return await pb.collection('store_orders').delete(id)
  },
}

export const mercadoPagoService = {
  /**
   * Obter configuração pública do Mercado Pago (para frontend da loja saber se ativa botão).
   * Lê diretamente da coleção mercadopago_settings (leitura pública garantida por regras RLS),
   * eliminando dependência frágil de routerAdd em tempo de execução.
   */
  async getPublicConfig(): Promise<MPPublicConfigResponse> {
    // 1. Tenta endpoint público seguro de backend (pb_hooks) sem expor tokens
    try {
      const res = await fetch(`${pb.baseURL}/api/store/mp/public-config`, {
        headers: { Accept: 'application/json' },
      })
      if (res.ok) {
        const data = await res.json()
        return {
          enabled: Boolean(data.enabled),
          public_key: data.public_key || '',
          store_title: data.store_title || 'AMbicorpFlow',
        }
      }
    } catch (_) {
      // continua para fallback se autenticado
    }

    // 2. Se usuário estiver autenticado (ex: admin), tenta ler da coleção
    if (pb.authStore.isValid) {
      try {
        const list = await pb
          .collection('mercadopago_settings')
          .getList<MercadoPagoSettings>(1, 1, {
            sort: '-created',
          })
        if (list.items.length > 0) {
          const s = list.items[0]
          const token = (s.mp_access_token || '').trim()
          const isEnabled = Boolean(s.mp_enabled)
          const hasValidToken = token.length > 10
          return {
            enabled: isEnabled && hasValidToken,
            public_key: s.mp_public_key || '',
            store_title: s.store_title || 'AMbicorpFlow',
          }
        }
      } catch {
        /* intentionally ignored */
      }
    }

    return { enabled: false, public_key: '', store_title: 'AMbicorpFlow' }
  },

  /**
   * Criar preferência de pagamento no Mercado Pago (Checkout Pro)
   */
  async createPreference(orderId: string, returnUrl?: string): Promise<MPCreatePreferenceResponse> {
    const returnBase = returnUrl || (typeof window !== 'undefined' ? window.location.origin : '')

    try {
      // 1. Tenta endpoint direto se estiver acessível
      const res = await fetch(`${pb.baseURL}/api/store/mp/create-preference`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          order_id: orderId,
          return_url: returnBase,
        }),
      })

      if (res.ok) {
        return await res.json()
      }
    } catch (_) {
      // continua para fallback
    }

    // 2. Se endpoint direto responder com erro ou 404, fallback seguro para WhatsApp
    return {
      ok: false,
      fallback_to_whatsapp: true,
      error: 'Finalização online indisponível no momento. Conclua seu pedido via WhatsApp.',
    }
  },

  /**
   * Obter configurações salvas (admin)
   */
  async getSettings(): Promise<MercadoPagoSettings | null> {
    try {
      const list = await pb.collection('mercadopago_settings').getFullList<MercadoPagoSettings>({
        sort: '-created',
        limit: 1,
      })
      return list[0] || null
    } catch (err) {
      console.error('Erro ao buscar configurações do Mercado Pago:', err)
      return null
    }
  },

  /**
   * Salvar configurações do Mercado Pago (admin)
   */
  async saveSettings(data: {
    id?: string
    mp_access_token: string
    mp_public_key: string
    mp_enabled: boolean
    store_title?: string
    statement_descriptor?: string
    webhook_secret?: string
    notes?: string
  }): Promise<MercadoPagoSettings> {
    if (data.id) {
      return await pb.collection('mercadopago_settings').update<MercadoPagoSettings>(data.id, data)
    } else {
      // Verifica se já existe um registro
      const existing = await this.getSettings()
      if (existing) {
        return await pb
          .collection('mercadopago_settings')
          .update<MercadoPagoSettings>(existing.id, data)
      }
      return await pb.collection('mercadopago_settings').create<MercadoPagoSettings>(data)
    }
  },

  /**
   * Testar conexão com a API do Mercado Pago.
   * Utiliza EXATAMENTE o mesmo mecanismo robusto e comprovado do Mercado Livre:
   * cria um job na coleção `mp_test_jobs`, o hook server-side `onRecordAfterCreateSuccess`
   * executa a chamada à API oficial do Mercado Pago no backend com $http.send,
   * e o frontend faz polling do resultado.
   * Não depende de routerAdd ou rotas HTTP instáveis no boot do PocketBase.
   */
  async testConnection(
    token?: string,
    onProgress?: (msg: string) => void,
  ): Promise<MPTestConnectionResponse> {
    const cleanToken = (token || '').trim()

    if (onProgress) {
      onProgress('Enviando solicitação de validação ao servidor...')
    }

    try {
      // 1. Criar registro na coleção mp_test_jobs
      const jobRecord = await pb.collection('mp_test_jobs').create({
        token_override: cleanToken,
        status: 'pending',
        requested_by: pb.authStore.record?.id || pb.authStore.model?.id || null,
      })

      const jobId = jobRecord.id

      // 2. Polling a cada 600ms (timeout 25s)
      const timeoutMs = 25_000
      const intervalMs = 600
      const startTime = Date.now()

      while (Date.now() - startTime < timeoutMs) {
        await new Promise((r) => setTimeout(r, intervalMs))

        const elapsed = Math.round((Date.now() - startTime) / 1000)
        if (onProgress) {
          onProgress(`Validando credenciais na API oficial do Mercado Pago (${elapsed}s)...`)
        }

        try {
          const current = await pb.collection('mp_test_jobs').getOne(jobId)
          const status = current.status

          if (status === 'done') {
            const userData = current.user_data || {}
            return {
              ok: true,
              configured: true,
              message: current.message || 'Conexão com Mercado Pago validada com sucesso!',
              status_code: current.status_code || 200,
              data: {
                id: userData.id,
                nickname: userData.nickname || '',
                first_name: userData.first_name || '',
                last_name: userData.last_name || '',
                email: userData.email || '',
                site_id: userData.site_id || 'MLB',
                user_type: userData.user_type || '',
                points: userData.points || 0,
              },
            }
          }

          if (status === 'error') {
            return {
              ok: false,
              configured: true,
              message: current.message || 'Falha ao validar credenciais no Mercado Pago.',
              status_code: current.status_code || 400,
            }
          }
        } catch (pollErr: any) {
          // Ignora erros transitórios de rede na leitura do registro
        }
      }

      return {
        ok: false,
        configured: true,
        message:
          'Tempo limite excedido ao aguardar validação das credenciais pelo servidor. Tente novamente.',
      }
    } catch (err: any) {
      console.error('Erro no fluxo de teste de conexão MP:', err)
      return {
        ok: false,
        configured: false,
        message:
          err.message ||
          'Não foi possível registrar o teste de conexão. Verifique sua sessão de administrador.',
      }
    }
  },
}
