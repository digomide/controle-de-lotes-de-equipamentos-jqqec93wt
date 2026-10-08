import pb from '@/lib/pocketbase/client'
import type {
  MLReputationDispute,
  CreateDisputeInput,
  UpdateDisputeInput,
  SyncClaimsResponse,
} from '@/types/reputationDisputes'

export const reputationDisputesService = {
  /**
   * Lista todas as contestações cadastradas com ordenação decrescente de criação/data
   */
  async listDisputes(options?: {
    status?: string
    search?: string
  }): Promise<MLReputationDispute[]> {
    const filters: string[] = []

    if (options?.status && options.status !== 'all') {
      filters.push(`dispute_status = "${options.status}"`)
    }

    if (options?.search?.trim()) {
      const q = options.search.trim().replace(/["\\]/g, '')
      filters.push(
        `(sale_id_ml ~ "${q}" || customer_name ~ "${q}" || customer_nickname ~ "${q}" || product_title ~ "${q}" || claim_id ~ "${q}")`,
      )
    }

    try {
      const records = await pb
        .collection('ml_reputation_disputes')
        .getFullList<MLReputationDispute>({
          sort: '-created',
          filter: filters.length > 0 ? filters.join(' && ') : undefined,
          requestKey: null,
        })
      return records
    } catch (err) {
      console.error('Erro ao listar disputas de reputação:', err)
      return []
    }
  },

  /**
   * Obtém uma contestação específica por ID
   */
  async getDisputeById(id: string): Promise<MLReputationDispute | null> {
    try {
      return await pb
        .collection('ml_reputation_disputes')
        .getOne<MLReputationDispute>(id, { requestKey: null })
    } catch (err) {
      console.error('Erro ao buscar contestação:', err)
      return null
    }
  },

  /**
   * Cria uma nova contestação
   */
  async createDispute(data: CreateDisputeInput): Promise<MLReputationDispute> {
    const defaultData: Partial<MLReputationDispute> = {
      dispute_status: 'Para redigir',
      reputation_impact: 'Afetada',
      problems_count: 1,
      ...data,
    }
    return await pb.collection('ml_reputation_disputes').create<MLReputationDispute>(defaultData)
  },

  /**
   * Atualiza dados de uma contestação (defesa, status, observações, cliente, etc.)
   */
  async updateDispute(id: string, data: UpdateDisputeInput): Promise<MLReputationDispute> {
    return await pb.collection('ml_reputation_disputes').update<MLReputationDispute>(id, data)
  },

  /**
   * Remove uma contestação
   */
  async deleteDispute(id: string): Promise<boolean> {
    try {
      await pb.collection('ml_reputation_disputes').delete(id)
      return true
    } catch (err) {
      console.error('Erro ao excluir contestação:', err)
      return false
    }
  },

  /**
   * Tenta sincronizar claims e cruzar com pedidos na API do Mercado Livre e banco local
   */
  async syncClaims(): Promise<SyncClaimsResponse> {
    const token = pb.authStore.token
    const headers: Record<string, string> = {}
    if (token) {
      headers.Authorization = token
    }

    try {
      const res = await pb.send<SyncClaimsResponse>(
        '/backend/v1/ml/reputation-disputes/sync-claims',
        {
          method: 'POST',
          headers,
        },
      )
      return res
    } catch (err: any) {
      console.error('Erro ao chamar hook de sync-claims:', err)
      return {
        ok: false,
        api_available: false,
        api_status_code: 500,
        claims_found: 0,
        local_orders_linked: 0,
        warning:
          'Não foi possível sincronizar claims via API (recurso restrito ou serviço indisponível).',
        message: err.message || 'Falha ao contatar servidor.',
      }
    }
  },

  /**
   * Busca dados de pedido local (ml_orders) para enriquecer pelo sale_id_ml
   */
  async lookupOrderLocal(saleIdMl: string) {
    if (!saleIdMl?.trim()) return null
    try {
      const cleanId = saleIdMl.trim().replace(/["\\]/g, '')
      const order = await pb
        .collection('ml_orders')
        .getFirstListItem(`order_id = "${cleanId}"`, { requestKey: null })
      return order
    } catch {
      return null
    }
  },
}
