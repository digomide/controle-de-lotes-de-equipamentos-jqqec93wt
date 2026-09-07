import pb from '@/lib/pocketbase/client'
import { normalizeSearchTerm } from '@/services/positionOverridesService'
import type { MLCollectorPayload, MLCollectorResultItem } from '@/lib/mlBookmarklet'

export interface MLCollectorImportRecord {
  id: string
  search_term: string
  source_url?: string
  imported_at?: string
  payload?: MLCollectorPayload
  results_count?: number
  with_sales_count?: number
  notes?: string
  created?: string
  updated?: string
}

export const mlCollectorService = {
  /**
   * Valida e normaliza o JSON antes de salvar
   */
  parseAndValidatePayload(rawJsonOrObj: string | any): MLCollectorPayload {
    let parsed: any
    if (typeof rawJsonOrObj === 'string') {
      try {
        parsed = JSON.parse(rawJsonOrObj.trim())
      } catch (err: any) {
        throw new Error('O texto informado não é um JSON válido: ' + err.message)
      }
    } else {
      parsed = rawJsonOrObj
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Estrutura de dados inválida.')
    }

    // Aceita tanto o formato completo { results: [...] } quanto array direto de itens [...]
    let results: MLCollectorResultItem[] = []
    let sourceUrl = parsed.source_url || ''
    let searchTerm = parsed.search_term || ''

    if (Array.isArray(parsed.results)) {
      results = parsed.results
    } else if (Array.isArray(parsed)) {
      results = parsed
    } else {
      throw new Error(
        'JSON de coleta deve conter o campo "results" ou ser um array de anúncios coletados.',
      )
    }

    if (results.length === 0) {
      throw new Error('Nenhum anúncio encontrado dentro do JSON de coleta.')
    }

    // Normalizar itens
    const normalizedResults: MLCollectorResultItem[] = results.map((rawItem: any, idx: number) => {
      const title = (rawItem.title || rawItem.name || '').trim()
      const rawPrice = rawItem.price
      const priceNum =
        typeof rawPrice === 'number'
          ? rawPrice
          : typeof rawPrice === 'string'
            ? parseFloat(rawPrice.replace(/[^0-9.]/g, ''))
            : undefined

      const rawSold = rawItem.sold_quantity
      const soldNum =
        typeof rawSold === 'number'
          ? rawSold
          : typeof rawSold === 'string'
            ? parseInt(rawSold, 10)
            : null

      return {
        id: rawItem.id || rawItem.mlb_id || `ITEM_${idx + 1}`,
        mlb_id: rawItem.mlb_id || rawItem.id || '',
        title: title || `Anúncio #${idx + 1}`,
        price: isNaN(priceNum as number) ? undefined : priceNum,
        condition: rawItem.condition || undefined,
        sold_quantity: isNaN(soldNum as number) ? null : soldNum,
        sold_quantity_text: rawItem.sold_quantity_text || undefined,
        available_quantity: rawItem.available_quantity || undefined,
        permalink: rawItem.permalink || rawItem.url || '',
        thumbnail: rawItem.thumbnail || rawItem.image || '',
        seller_name: rawItem.seller_name || rawItem.seller || '',
        is_free_shipping: Boolean(rawItem.is_free_shipping),
        is_full: Boolean(rawItem.is_full),
      }
    })

    const withSales = normalizedResults.filter(
      (r) => r.sold_quantity != null && r.sold_quantity > 0,
    ).length

    return {
      version: parsed.version || '1.0.0',
      source_url: sourceUrl,
      collected_at: parsed.collected_at || new Date().toISOString(),
      search_term: searchTerm,
      results_count: normalizedResults.length,
      with_sales_count: withSales,
      results: normalizedResults,
    }
  },

  /**
   * Salva a coleta no PocketBase
   */
  async saveCollectorImport(params: {
    searchTerm: string
    payload: MLCollectorPayload
    sourceUrl?: string
    notes?: string
  }): Promise<MLCollectorImportRecord> {
    const term = normalizeSearchTerm(params.searchTerm || params.payload.search_term || '')
    if (!term) {
      throw new Error('O termo de busca é obrigatório para registrar a coleta.')
    }

    const payload = params.payload
    const record = await pb.collection('ml_collector_imports').create<MLCollectorImportRecord>({
      search_term: term,
      source_url: params.sourceUrl || payload.source_url || '',
      imported_at: new Date().toISOString(),
      payload,
      results_count: payload.results_count || payload.results.length,
      with_sales_count: payload.with_sales_count || 0,
      notes: params.notes || '',
    })

    return record
  },

  /**
   * Busca a coleta mais recente para um determinado termo de pesquisa
   */
  async getLatestImportForTerm(searchTerm: string): Promise<MLCollectorImportRecord | null> {
    const term = normalizeSearchTerm(searchTerm)
    if (!term) return null

    try {
      const records = await pb
        .collection('ml_collector_imports')
        .getList<MLCollectorImportRecord>(1, 1, {
          filter: `search_term = "${term}"`,
          sort: '-imported_at,-created',
        })

      if (records && records.items && records.items.length > 0) {
        return records.items[0]
      }
    } catch (err) {
      console.warn('[mlCollectorService] Erro ao buscar coleta por termo:', err)
    }

    return null
  },

  /**
   * Lista o histórico recente de coletas
   */
  async listRecentImports(limit = 20): Promise<MLCollectorImportRecord[]> {
    try {
      const records = await pb
        .collection('ml_collector_imports')
        .getList<MLCollectorImportRecord>(1, limit, {
          sort: '-imported_at,-created',
        })
      return records.items || []
    } catch (err) {
      console.warn('[mlCollectorService] Erro ao listar coletas:', err)
      return []
    }
  },

  /**
   * Remove uma importação de histórico
   */
  async deleteImport(id: string): Promise<boolean> {
    try {
      await pb.collection('ml_collector_imports').delete(id)
      return true
    } catch (err) {
      console.warn('[mlCollectorService] Erro ao remover coleta:', err)
      return false
    }
  },
}
