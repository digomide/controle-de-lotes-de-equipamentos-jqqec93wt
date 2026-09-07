import pb from '@/lib/pocketbase/client'

export type PositionOverrideAction = 'include' | 'exclude'

export interface PositionOverrideRecord {
  id: string
  search_term: string
  ml_item_id: string
  action: PositionOverrideAction
  title?: string
  permalink?: string
  notes?: string
  created?: string
  updated?: string
}

export function normalizeSearchTerm(term: string): string {
  return (term || '').trim().toLowerCase()
}

export const positionOverridesService = {
  /**
   * Busca todos os overrides cadastrados para um termo de busca
   */
  async getOverridesForTerm(searchTerm: string): Promise<Record<string, PositionOverrideAction>> {
    const norm = normalizeSearchTerm(searchTerm)
    if (!norm) return {}

    try {
      const records = await pb
        .collection('ml_position_overrides')
        .getFullList<PositionOverrideRecord>({
          filter: `search_term = "${norm}"`,
          sort: '-created',
        })

      const map: Record<string, PositionOverrideAction> = {}
      for (const rec of records) {
        if (rec.ml_item_id && rec.action) {
          // Último gravado tem precedência
          if (!map[rec.ml_item_id]) {
            map[rec.ml_item_id] = rec.action
          }
        }
      }
      return map
    } catch (err) {
      console.warn('[positionOverridesService] Erro ao buscar overrides:', err)
      return {}
    }
  },

  /**
   * Salva ou atualiza override de um anúncio para o termo
   */
  async setOverride(params: {
    searchTerm: string
    mlItemId: string
    action: PositionOverrideAction
    title?: string
    permalink?: string
    notes?: string
  }): Promise<PositionOverrideRecord> {
    const norm = normalizeSearchTerm(params.searchTerm)
    const itemId = (params.mlItemId || '').trim()

    if (!norm || !itemId) {
      throw new Error('search_term e ml_item_id são obrigatórios')
    }

    // Checar se já existe override para este par
    let existingId: string | null = null
    try {
      const existing = await pb
        .collection('ml_position_overrides')
        .getFirstListItem<PositionOverrideRecord>(
          `search_term = "${norm}" && ml_item_id = "${itemId}"`,
        )
      existingId = existing.id
    } catch {
      /* intentionally ignored */
    }

    if (existingId) {
      return await pb
        .collection('ml_position_overrides')
        .update<PositionOverrideRecord>(existingId, {
          action: params.action,
          title: params.title || '',
          permalink: params.permalink || '',
          notes: params.notes || '',
        })
    }

    return await pb.collection('ml_position_overrides').create<PositionOverrideRecord>({
      search_term: norm,
      ml_item_id: itemId,
      action: params.action,
      title: params.title || '',
      permalink: params.permalink || '',
      notes: params.notes || '',
    })
  },

  /**
   * Remove o override manual (voltando ao julgamento automático do filtro)
   */
  async removeOverride(searchTerm: string, mlItemId: string): Promise<boolean> {
    const norm = normalizeSearchTerm(searchTerm)
    const itemId = (mlItemId || '').trim()

    try {
      const existing = await pb
        .collection('ml_position_overrides')
        .getFirstListItem<PositionOverrideRecord>(
          `search_term = "${norm}" && ml_item_id = "${itemId}"`,
        )
      if (existing.id) {
        await pb.collection('ml_position_overrides').delete(existing.id)
        return true
      }
    } catch {
      /* intentionally ignored */
    }
    return false
  },
}
