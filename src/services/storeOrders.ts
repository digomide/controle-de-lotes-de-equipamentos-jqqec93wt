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
   * Obter configuração pública do Mercado Pago (para frontend da loja saber se ativa botão)
   */
  async getPublicConfig(): Promise<MPPublicConfigResponse> {
    try {
      const res = await fetch(`${pb.baseUrl}/api/store/mp/public-config`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      })
      if (res.ok) {
        return await res.json()
      }
      return { enabled: false, public_key: '', store_title: 'AMbicorpFlow' }
    } catch (err) {
      console.warn('Falha ao consultar config pública do Mercado Pago:', err)
      return { enabled: false, public_key: '', store_title: 'AMbicorpFlow' }
    }
  },

  /**
   * Criar preferência de pagamento no Mercado Pago (Checkout Pro)
   */
  async createPreference(orderId: string, returnUrl?: string): Promise<MPCreatePreferenceResponse> {
    const returnBase = returnUrl || (typeof window !== 'undefined' ? window.location.origin : '')

    const res = await fetch(`${pb.baseUrl}/api/store/mp/create-preference`, {
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

    const data = await res.json()
    return data
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
   * Testar conexão com a API do Mercado Pago
   */
  async testConnection(token?: string): Promise<MPTestConnectionResponse> {
    try {
      const res = await pb.send<MPTestConnectionResponse>('/api/store/mp/test-connection', {
        method: 'POST',
        body: token ? { mp_access_token: token } : {},
      })
      return res
    } catch (err: any) {
      return {
        ok: false,
        configured: false,
        message: err.message || 'Falha ao executar teste de conexão com o Mercado Pago.',
      }
    }
  },
}
