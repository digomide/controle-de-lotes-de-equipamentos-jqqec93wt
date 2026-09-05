import pb from '@/lib/pocketbase/client'

export interface MLCompetitor {
  id: string
  seller_id: string
  nickname: string
  notes?: string
  active: boolean
  permalink?: string
  last_synced_at?: string
  created: string
  updated: string
  // Métricas calculadas na tela
  ads_count?: number
  active_ads_count?: number
  avg_price?: number
  total_sold?: number
}

export interface MLCompetitorAd {
  id: string
  mlb_item_id: string
  seller_id: string
  seller_nickname?: string
  title: string
  current_price: number
  initial_price?: number
  sold_quantity: number
  available_quantity: number
  status: 'active' | 'paused' | 'closed' | string
  permalink: string
  thumbnail: string
  condition?: string
  brand?: string
  model?: string
  gtin?: string
  last_checked?: string
  created: string
  updated: string
  // Vínculo com catálogo nosso
  matchedProduct?: {
    id: string
    name: string
    sku: string
    unit_price: number
    status: string
    diff_percent: number // % do nosso preço vs concorrente
  }
}

export interface MLPriceSnapshot {
  id: string
  mlb_item_id: string
  seller_id?: string
  price: number
  sold_quantity?: number
  available_quantity?: number
  status?: string
  checked_at: string
}

export interface MLCompetitorEvent {
  id: string
  mlb_item_id: string
  seller_id: string
  seller_nickname?: string
  ad_title?: string
  event_type:
    | 'price_change'
    | 'sold_progress'
    | 'new_ad'
    | 'ad_paused'
    | 'ad_closed'
    | 'stock_change'
    | string
  old_value?: string
  new_value?: string
  difference_num?: number
  notes?: string
  created: string
}

export interface MLCompetitorJob {
  id: string
  action:
    | 'resolve_from_item'
    | 'resolve_competitor'
    | 'sync_competitor'
    | 'sync_all'
    | 'search_query'
  query?: string
  seller_id?: string
  seller_nickname?: string
  status: 'pending' | 'processing' | 'done' | 'error'
  status_code?: number
  error_message?: string
  result_data?: any
  requested_by?: string
  created: string
}

/**
 * Utilitário para extrair IDs MLB de textos, URLs ou listas com separadores
 * Exemplos aceitos:
 * - https://produto.mercadolivre.com.br/MLB-4709060403-...
 * - https://www.mercadolivre.com.br/...-MLB4709060403
 * - MLB4709060403 ou MLB-4709060403
 * - Múltiplos links colados (um por linha, separados por vírgula ou espaço)
 */
export function extractMlbIds(input: string): string[] {
  if (!input) return []
  const matches = input.match(/MLB-?[0-9]{8,14}/gi)
  if (!matches) return []
  const unique = new Set<string>()
  for (const m of matches) {
    const clean = m.toUpperCase().replace('-', '')
    unique.add(clean)
  }
  return Array.from(unique)
}

export const mlCompetitorService = {
  // 1. Concorrentes cadastrados
  async getCompetitors(): Promise<MLCompetitor[]> {
    return await pb.collection('ml_competitors').getFullList<MLCompetitor>({
      sort: '-created',
    })
  },

  async addCompetitor(data: {
    seller_id: string
    nickname: string
    notes?: string
    permalink?: string
  }): Promise<MLCompetitor> {
    const cleanId = String(data.seller_id).trim()
    const cleanNick = (data.nickname || '').trim() || `Vendedor ${cleanId}`

    // Verificar se já existe
    try {
      const existing = await pb
        .collection('ml_competitors')
        .getFirstListItem(`seller_id="${cleanId}"`)
      if (existing) {
        // Atualiza para ativo se estava inativo
        return await pb.collection('ml_competitors').update<MLCompetitor>(existing.id, {
          active: true,
          nickname: cleanNick || existing.nickname,
          notes: data.notes ?? existing.notes,
          permalink: data.permalink ?? existing.permalink,
        })
      }
    } catch {
      /* intentionally ignored */
    }

    return await pb.collection('ml_competitors').create<MLCompetitor>({
      seller_id: cleanId,
      nickname: cleanNick,
      notes: data.notes || '',
      permalink: data.permalink || '',
      active: true,
    })
  },

  async updateCompetitor(id: string, data: Partial<MLCompetitor>): Promise<MLCompetitor> {
    return await pb.collection('ml_competitors').update<MLCompetitor>(id, data)
  },

  async toggleCompetitorStatus(id: string, active: boolean): Promise<MLCompetitor> {
    return await pb.collection('ml_competitors').update<MLCompetitor>(id, { active })
  },

  async deleteCompetitor(id: string): Promise<boolean> {
    return await pb.collection('ml_competitors').delete(id)
  },

  // 2. Anúncios monitorados
  async getCompetitorAds(filter?: string): Promise<MLCompetitorAd[]> {
    return await pb.collection('ml_competitor_ads').getFullList<MLCompetitorAd>({
      sort: '-last_checked',
      filter: filter || '',
    })
  },

  // 3. Histórico de preços por anúncio
  async getPriceHistory(mlbItemId: string, limit = 30): Promise<MLPriceSnapshot[]> {
    return await pb.collection('ml_price_history').getFullList<MLPriceSnapshot>({
      filter: `mlb_item_id = "${mlbItemId}"`,
      sort: 'checked_at',
      limit,
    })
  },

  // 4. Feed de Eventos
  async getEvents(limit = 100, filter?: string): Promise<MLCompetitorEvent[]> {
    return await pb.collection('ml_competitor_events').getFullList<MLCompetitorEvent>({
      filter: filter || '',
      sort: '-created',
      limit,
    })
  },

  // 5. Execução de Jobs Assíncronos com Polling
  async dispatchJobAndWait(
    action:
      | 'resolve_from_item'
      | 'resolve_competitor'
      | 'sync_competitor'
      | 'sync_all'
      | 'search_query',
    params: {
      query?: string
      seller_id?: string
      seller_nickname?: string
      result_data?: any
    },
    timeoutMs = 45_000,
  ): Promise<MLCompetitorJob> {
    const jobRecord = await pb.collection('ml_competitor_jobs').create<MLCompetitorJob>({
      action,
      query: (params.query || '').trim(),
      seller_id: (params.seller_id || '').trim(),
      seller_nickname: (params.seller_nickname || '').trim(),
      result_data: params.result_data || undefined,
      status: 'pending',
      requested_by: pb.authStore.model?.id || undefined,
    })

    const startTime = Date.now()
    const intervalMs = 600

    while (Date.now() - startTime < timeoutMs) {
      await new Promise((r) => setTimeout(r, intervalMs))

      try {
        const current = await pb
          .collection('ml_competitor_jobs')
          .getOne<MLCompetitorJob>(jobRecord.id)
        if (current.status === 'done') {
          return current
        }
        if (current.status === 'error') {
          throw new Error(current.error_message || 'Falha ao processar operação no servidor.')
        }
      } catch (pollErr: any) {
        if (pollErr.message && !pollErr.status) {
          throw pollErr
        }
      }
    }

    throw new Error(
      'Tempo limite excedido ao aguardar resposta do Mercado Livre. O robô continuará em segundo plano.',
    )
  },

  // Atalho para adicionar concorrente e anúncios a partir de links ou códigos MLB
  async resolveFromItems(input: string, sellerNickname?: string): Promise<MLCompetitorJob> {
    const ids = extractMlbIds(input)
    if (ids.length === 0) {
      throw new Error(
        'Nenhum código MLB válido encontrado. Cole o link do anúncio do Mercado Livre ou código como MLB1234567890.',
      )
    }

    return await this.dispatchJobAndWait('resolve_from_item', {
      query: ids.join('\n'),
      seller_nickname: sellerNickname,
      result_data: { item_ids: ids },
    })
  },

  // 6. Cruzamento com produtos locais (Notebooks / Catálogo)
  matchAdWithLocalCatalog(adTitle: string, products: any[]): any | null {
    if (!adTitle || !products || products.length === 0) return null

    const titleLower = adTitle.toLowerCase()

    // Procurar casamento por modelo (ex: "T480", "T580", "Latitude 5320", "P1 Gen2", "840 G4", "3520", etc.)
    for (const p of products) {
      const pModel = (p.model || '').toLowerCase().trim()
      const pSku = (p.sku || '').toLowerCase().trim()
      const pName = (p.name || '').toLowerCase().trim()

      let matches = false

      if (pModel && pModel.length >= 3 && titleLower.includes(pModel)) {
        matches = true
      } else if (pSku && pSku.length >= 4 && titleLower.includes(pSku)) {
        matches = true
      } else {
        // Tenta marcas + modelos conhecidos
        const brand = (p.brand || '').toLowerCase().trim()
        if (brand && titleLower.includes(brand)) {
          // Extrai tokens significativos do model
          const modelParts = pModel.split(/[\s-]+/).filter((w: string) => w.length >= 3)
          if (
            modelParts.length > 0 &&
            modelParts.some((part: string) => titleLower.includes(part))
          ) {
            matches = true
          }
        }
      }

      if (matches) {
        const ourPrice = Number(p.unit_price) || 0
        return {
          id: p.id,
          name: p.name,
          sku: p.sku,
          unit_price: ourPrice,
          status: p.status,
        }
      }
    }

    return null
  },
}
