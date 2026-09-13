import pb from '@/lib/pocketbase/client'

export type MLSellerAuthStatus = 'connected' | 'expiring' | 'unauthorized' | 'demo' | 'public_only'
export type MLSellerType = 'connected' | 'demo' | 'public'

export interface MLSellerRecord {
  id: string
  seller_id: string
  nickname: string
  seller_type: MLSellerType
  auth_status: MLSellerAuthStatus
  status_message: string
  reputation_level: string // '5_green', '4_light_green', '3_yellow', '2_orange', '1_red'
  power_seller_status: 'platinum' | 'gold' | 'silver' | null
  active_ads_count: number
  paused_ads_count: number
  closed_ads_count: number
  total_ads_count: number
  sales_7d_count: number
  sales_30d_count: number
  sales_30d_amount: number
  pending_questions_count: number
  avg_response_time_minutes: number
  paused_spike_alert: boolean
  reputation_drop_alert: boolean
  metrics_snapshot?: {
    last_error_code?: number | null
    last_error_detail?: string | null
    recent_spikes?: string
    demo_mode?: boolean
    reputation_warning?: string
    token_expires_at?: string
    last_reauth_at?: string
    historical_active_ads?: number[]
  }
  last_synced_at: string
  notes?: string
  created?: string
  updated?: string
}

export interface MLSellersKPIs {
  total_sellers: number
  total_active_ads: number
  total_30d_sales: number
  total_30d_amount: number
  alert_count: number
  unauthorized_count: number
}

export interface MLSellersListResponse {
  ok: boolean
  sellers: MLSellerRecord[]
  kpis: MLSellersKPIs
  error?: string
}

export interface MLSellerSyncResponse {
  ok: boolean
  synced_count: number
  results: {
    seller_id: string
    nickname: string
    status: 'ok' | 'unauthorized' | 'error'
    message: string
  }[]
  error?: string
}

export interface MLSellerReauthInput {
  seller_id: string
  access_token?: string
  refresh_token?: string
  simulated_demo_fix?: boolean
}

export interface MLSellerCreateInput {
  seller_id: string
  nickname: string
  seller_type?: MLSellerType
  notes?: string
  access_token?: string
}

export const mlSellersService = {
  /**
   * Obtém a lista completa de sellers monitorados com contadores e status de autenticação
   */
  async listSellers(): Promise<MLSellersListResponse> {
    try {
      const res = await pb.send<MLSellersListResponse>('/backend/v1/ml/sellers/list', {
        method: 'GET',
      })
      return res
    } catch (err: any) {
      console.error('[mlSellersService] Erro ao listar sellers:', err)
      return {
        ok: false,
        sellers: [],
        kpis: {
          total_sellers: 0,
          total_active_ads: 0,
          total_30d_sales: 0,
          total_30d_amount: 0,
          alert_count: 0,
          unauthorized_count: 0,
        },
        error: err?.message || 'Falha ao consultar sellers monitorados.',
      }
    }
  },

  /**
   * Sincroniza dados com a API do Mercado Livre (somente-leitura)
   */
  async syncSellers(sellerId?: string): Promise<MLSellerSyncResponse> {
    const res = await pb.send<MLSellerSyncResponse>('/backend/v1/ml/sellers/sync', {
      method: 'POST',
      body: { seller_id: sellerId || '' },
    })
    return res
  },

  /**
   * Reautentica a conta de um seller (resolve erro 401 de parceiros como TAY TECH)
   */
  async reauthSeller(
    input: MLSellerReauthInput,
  ): Promise<{ ok: boolean; message: string; error?: string }> {
    const res = await pb.send<{ ok: boolean; message: string; error?: string }>(
      '/backend/v1/ml/sellers/reauth',
      {
        method: 'POST',
        body: input,
      },
    )
    return res
  },

  /**
   * Cadastra novo seller monitorado (conectado ou demo)
   */
  async createSeller(
    input: MLSellerCreateInput,
  ): Promise<{ ok: boolean; message: string; seller_id?: string; error?: string }> {
    const res = await pb.send<{ ok: boolean; message: string; seller_id?: string; error?: string }>(
      '/backend/v1/ml/sellers/create',
      {
        method: 'POST',
        body: input,
      },
    )
    return res
  },

  /**
   * Remove seller do monitoramento
   */
  async deleteSeller(sellerId: string): Promise<{ ok: boolean; message: string; error?: string }> {
    const res = await pb.send<{ ok: boolean; message: string; error?: string }>(
      '/backend/v1/ml/sellers/delete',
      {
        method: 'POST',
        body: { seller_id: sellerId },
      },
    )
    return res
  },
}
