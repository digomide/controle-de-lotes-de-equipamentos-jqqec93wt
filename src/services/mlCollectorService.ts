import pb from '@/lib/pocketbase/client'
import {
  normalizeSearchTerm,
  positionOverridesService,
  type PositionOverrideAction,
} from '@/services/positionOverridesService'
import {
  detectCollectorNoiseAd,
  softenSearchTerm,
  matchesExactModelInTitle,
  removeAccents,
  isCollectorTermCompatible,
  isDirtyCollectorTerm,
} from '@/lib/catalogFilter'
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

export interface CollectorDeduplicatedAd {
  id: string
  mlb_id?: string
  title: string
  price?: number
  sold_quantity: number | null
  seller_name?: string
  permalink?: string
  thumbnail?: string
  is_free_shipping?: boolean
  is_full?: boolean
  condition?: string
  subfamily?: string
}

export interface CollectorSpecMetrics {
  spec: string
  totalUnits: number
  totalRevenue: number
  adCount: number
  adsWithSalesCount: number
  adsWithoutSalesCount: number
  weightedAvgPrice: number
  simpleAvgPrice: number
  medianPrice: number
  minPrice: number
  maxPrice: number
  sharePercent: number
  championAd: CollectorDeduplicatedAd | null
  ads: CollectorDeduplicatedAd[]
}

export type CollectorTopSpec = CollectorSpecMetrics

export interface CollectorSummaryReport {
  ok: boolean
  term: string
  imports_count: number
  imports: Array<{
    id: string
    created: string
    source_url?: string
    results_count: number
    with_sales_count: number
  }>
  total_deduplicated_ads: number
  ads_with_sales_count: number
  total_sold_units: number
  weighted_avg_price: number
  simple_avg_price: number
  median_price: number
  min_price: number
  max_price: number
  champion_ad: CollectorDeduplicatedAd | null
  top_ads: CollectorDeduplicatedAd[]
  top_specs: CollectorTopSpec[]
  all_specs: CollectorSpecMetrics[]
  all_deduplicated_ads: CollectorDeduplicatedAd[]
  // Ruído e exclusões
  noise_ads_count?: number
  noise_ads?: CollectorDeduplicatedAd[]
  manually_excluded_count?: number
  manually_included_count?: number
  raw_total_ads_count?: number
}

export interface MLCollectorKeyRecord {
  id: string
  key: string
  name?: string
  user_id?: string
  active: boolean
  last_used_at?: string
  created?: string
  updated?: string
}

// Gerenciador de requisições em trânsito e AbortController para deduplicação e cancelamento
const inFlightRequests = new Map<string, Promise<any>>()
let activeSearchAbortController: AbortController | null = null

export const mlCollectorService = {
  /**
   * Cancela requisições anteriores ativas de coleta caso o termo tenha mudado
   */
  abortActiveRequests(): void {
    if (activeSearchAbortController) {
      try {
        activeSearchAbortController.abort()
      } catch {
        /* intentionally ignored */
      }
      activeSearchAbortController = null
    }
  },

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
      version: parsed.version || '1.1.0',
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
      notes: params.notes || 'manual',
    })

    return record
  },

  /**
   * Busca a coleta mais recente para um determinado termo de pesquisa
   */
  async getLatestImportForTerm(searchTerm: string): Promise<MLCollectorImportRecord | null> {
    const term = normalizeSearchTerm(searchTerm)
    if (!term) return null

    const cacheKey = `latest_import:${term}`
    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey)!
    }

    const promise = (async () => {
      try {
        // Lista de termos para tentar: original normalizado + termo suavizado (sem stopwords/genéricas)
        const candidates = [term]
        const softened = normalizeSearchTerm(softenSearchTerm(term))
        if (softened && softened !== term) {
          candidates.push(softened)
        }

        for (const candidate of candidates) {
          // 1. Tentar correspondência exata
          let records = await pb
            .collection('ml_collector_imports')
            .getList<MLCollectorImportRecord>(1, 10, {
              filter: `search_term = "${candidate}"`,
              sort: '-imported_at',
            })

          if (records && records.items && records.items.length > 0) {
            for (const item of records.items) {
              if (
                !isDirtyCollectorTerm(item.search_term) &&
                isCollectorTermCompatible(term, item.search_term)
              ) {
                if (item.payload) {
                  item.payload = this.decodePayload(item.payload) || item.payload
                }
                return item
              }
            }
          }

          // 2. Tentar busca ampla por contém
          records = await pb
            .collection('ml_collector_imports')
            .getList<MLCollectorImportRecord>(1, 15, {
              filter: `search_term ~ "${candidate}"`,
              sort: '-imported_at',
            })

          if (records && records.items && records.items.length > 0) {
            for (const item of records.items) {
              if (
                !isDirtyCollectorTerm(item.search_term) &&
                isCollectorTermCompatible(term, item.search_term)
              ) {
                if (item.payload) {
                  item.payload = this.decodePayload(item.payload) || item.payload
                }
                return item
              }
            }
          }
        }

        // 3. Tentar pelos tokens significativos individuais do termo suavizado (AND obrigatório + validação de compatibilidade)
        const activeTermForTokens = candidates[candidates.length - 1]
        const tokens = activeTermForTokens.split(/\s+/).filter((t) => t.length >= 3)
        if (tokens.length > 0) {
          const tokenFilter = tokens.map((t) => `search_term ~ "${t}"`).join(' && ')
          const records = await pb
            .collection('ml_collector_imports')
            .getList<MLCollectorImportRecord>(1, 15, {
              filter: tokenFilter,
              sort: '-imported_at',
            })
          if (records && records.items && records.items.length > 0) {
            for (const item of records.items) {
              if (
                !isDirtyCollectorTerm(item.search_term) &&
                isCollectorTermCompatible(term, item.search_term)
              ) {
                if (item.payload) {
                  item.payload = this.decodePayload(item.payload) || item.payload
                }
                return item
              }
            }
          }
        }
      } catch (err) {
        console.warn('[mlCollectorService] Erro ao buscar coleta por termo:', err)
      }

      return null
    })().finally(() => {
      inFlightRequests.delete(cacheKey)
    })

    inFlightRequests.set(cacheKey, promise)
    return promise
  },

  /**
   * Obtém os anúncios deduplicados do coletor correspondentes a um termo de busca,
   * aplicando o mesmo suavizador de stopwords/genéricas da API do catálogo.
   * Retorna os anúncios minerados prontos para mesclagem ou fallback na grade de catálogo.
   */
  async getCollectorAdsForTerm(searchTerm: string): Promise<{
    ads: CollectorDeduplicatedAd[]
    matchedSearchTerm: string
    importRecord: MLCollectorImportRecord | null
  }> {
    const importRecord = await this.getLatestImportForTerm(searchTerm)
    if (!importRecord) {
      return { ads: [], matchedSearchTerm: '', importRecord: null }
    }

    // Filtro rigoroso por modelo no título do anúncio coletado:
    // Um anúncio coletado só entra na lista do banner e na contagem se o título contiver o modelo
    // exato do termo buscado (ex: "notebook lenovo t480" -> modelo "t480" -> só anúncios com "t480").
    const queryForFilter = searchTerm || importRecord.search_term || ''

    const isMatchModel = (title: string): boolean => {
      return matchesExactModelInTitle(title, queryForFilter).matches
    }

    try {
      const report = await this.getCollectorSummaryReport(importRecord.search_term)
      const rawAds = report?.all_deduplicated_ads || []
      const ads = rawAds.filter((ad) => isMatchModel(ad.title))
      return {
        ads,
        matchedSearchTerm: importRecord.search_term,
        importRecord,
      }
    } catch (err) {
      console.warn('[mlCollectorService] Erro ao extrair anúncios do resumo da coleta:', err)
      // Fallback: extrair diretamente do payload
      const payload = this.decodePayload(importRecord.payload)
      const rawResults = payload && Array.isArray(payload.results) ? payload.results : []
      const rawAds: CollectorDeduplicatedAd[] = rawResults.map((it: any, idx: number) => ({
        id: it.mlb_id || it.id || `COL_${idx + 1}`,
        mlb_id: it.mlb_id || it.id || `COL_${idx + 1}`,
        title: it.title || '',
        price: it.price || 0,
        sold_quantity: it.sold_quantity != null ? Number(it.sold_quantity) : null,
        permalink: it.permalink || it.url || '',
        thumbnail: it.thumbnail || it.image || '',
        seller_name: it.seller_name || it.seller || '',
        condition: it.condition || 'used',
        is_free_shipping: Boolean(it.is_free_shipping),
        is_full: Boolean(it.is_full),
      }))
      const ads = rawAds.filter((ad) => isMatchModel(ad.title))
      return {
        ads,
        matchedSearchTerm: importRecord.search_term,
        importRecord,
      }
    }
  },

  /**
   * Constrói um mapa de fallback de vendas (sold_quantity) indexado por MLB id e por título
   * normalizado a partir das coletas salvas do navegador.
   * Permite que produtos de catálogo cuja API omitiu sold_quantity recuperem o número exato
   * observado na vitrine do Mercado Livre.
   */
  // Cache em memória com limite LRU de 10 entradas e TTL de 3 minutos
  _fallbackMapCache: new Map<
    string,
    {
      timestamp: number
      data: {
        byMlbId: Map<string, number>
        byTitle: Map<string, number>
        adByMlbId: Map<string, CollectorDeduplicatedAd>
      }
    }
  >(),
  _MAX_CACHE_ENTRIES: 10,
  _CACHE_TTL_MS: 3 * 60 * 1000, // 3 minutos

  /**
   * Constrói mapa cruzado de histórico de vendas (sold_quantity) por MLB ID e por título
   * normalizado a partir das coletas salvas do navegador.
   * Permite que produtos de catálogo cuja API omitiu sold_quantity recuperem o número exato
   * observado na vitrine do Mercado Livre.
   * Otimizado: filtra registros recentes no PocketBase e memoiza com cache LRU (10 entradas, TTL 3 min).
   */
  async buildSalesFallbackMap(searchTerm?: string): Promise<{
    byMlbId: Map<string, number>
    byTitle: Map<string, number>
    adByMlbId: Map<string, CollectorDeduplicatedAd>
  }> {
    const cacheKey = searchTerm ? normalizeSearchTerm(searchTerm) : '__general__'
    const cached = this._fallbackMapCache.get(cacheKey)
    const CACHE_TTL_MS = this._CACHE_TTL_MS
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      // LRU refresh: re-insere para manter a chave no final (mais recentemente usada)
      this._fallbackMapCache.delete(cacheKey)
      this._fallbackMapCache.set(cacheKey, cached)
      return cached.data
    }

    const byMlbId = new Map<string, number>()
    const byTitle = new Map<string, number>()
    const adByMlbId = new Map<string, CollectorDeduplicatedAd>()

    try {
      const records = searchTerm
        ? await (async () => {
            const term = normalizeSearchTerm(searchTerm)
            const softened = normalizeSearchTerm(softenSearchTerm(term))
            const effectiveTerm = softened || term

            // 1. Tentar busca direta pelo termo normalizado ou suavizado (limitado aos 10 registros mais recentes)
            let list = await pb
              .collection('ml_collector_imports')
              .getList<MLCollectorImportRecord>(1, 10, {
                filter: `search_term ~ "${effectiveTerm}"`,
                sort: '-imported_at',
              })

            // 2. Se vazio, buscar por tokens significativos com AND estrito
            if (list.items.length === 0) {
              const tokens = effectiveTerm.split(/\s+/).filter((t) => t.length >= 3)
              if (tokens.length > 0) {
                const tokenFilter = tokens.map((t) => `search_term ~ "${t}"`).join(' && ')
                list = await pb
                  .collection('ml_collector_imports')
                  .getList<MLCollectorImportRecord>(1, 10, {
                    filter: tokenFilter,
                    sort: '-imported_at',
                  })
              }
            }

            // Filtrar apenas registros não-sujos e compatíveis estritamente com o termo buscado
            list.items = list.items.filter(
              (item) =>
                !isDirtyCollectorTerm(item.search_term) &&
                isCollectorTermCompatible(term, item.search_term),
            )
            return list
          })()
        : await pb.collection('ml_collector_imports').getList<MLCollectorImportRecord>(1, 10, {
            filter: 'search_term != "busca mercado livre" && search_term != "pl"',
            sort: '-imported_at',
          })

      for (const rec of records.items) {
        const payload = this.decodePayload(rec.payload)
        const items = payload && Array.isArray(payload.results) ? payload.results : []
        for (const it of items) {
          const sold =
            it.sold_quantity != null && !isNaN(Number(it.sold_quantity))
              ? Number(it.sold_quantity)
              : null
          const price = it.price != null && !isNaN(Number(it.price)) ? Number(it.price) : undefined

          const adObj: CollectorDeduplicatedAd = {
            id: String(it.mlb_id || it.id || ''),
            mlb_id: it.mlb_id || it.id,
            title: String(it.title || ''),
            price,
            sold_quantity: sold,
            seller_name: it.seller_name || '',
            permalink: it.permalink || '',
            thumbnail: it.thumbnail || '',
            is_free_shipping: Boolean(it.is_free_shipping),
            is_full: Boolean(it.is_full),
            condition: it.condition || '',
          }

          // Chaves de ID / MLB com e sem prefixo MLB
          const ids = [it.mlb_id, it.id].filter(Boolean) as string[]
          for (const rawId of ids) {
            const cleanId = String(rawId)
              .replace(/[^0-9A-Za-z]/g, '')
              .toUpperCase()
            if (cleanId) {
              // Com prefixo MLB (ex: MLB5761444412)
              const withMlb = cleanId.startsWith('MLB') ? cleanId : `MLB${cleanId}`
              const curWith = byMlbId.get(withMlb) || 0
              if (sold != null && sold > 0 && sold > curWith) byMlbId.set(withMlb, sold)
              if (
                !adByMlbId.has(withMlb) ||
                (sold != null && sold > (adByMlbId.get(withMlb)?.sold_quantity || 0))
              ) {
                adByMlbId.set(withMlb, adObj)
              }

              // Sem prefixo MLB (ex: 5761444412)
              const withoutMlb = cleanId.replace(/^MLB/, '')
              if (withoutMlb) {
                const curWithout = byMlbId.get(withoutMlb) || 0
                if (sold != null && sold > 0 && sold > curWithout) byMlbId.set(withoutMlb, sold)
                if (
                  !adByMlbId.has(withoutMlb) ||
                  (sold != null && sold > (adByMlbId.get(withoutMlb)?.sold_quantity || 0))
                ) {
                  adByMlbId.set(withoutMlb, adObj)
                }
              }
            }
          }

          // Chave de Título Normalizado (para casar catálogo com o anúncio minerado correspondente)
          if (it.title && sold != null && sold > 0) {
            const titleKey = String(it.title)
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/[^a-z0-9]/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
            if (titleKey.length >= 8) {
              const current = byTitle.get(titleKey) || 0
              if (sold > current) byTitle.set(titleKey, sold)
            }
          }
        }
      }
    } catch (err) {
      console.warn('[mlCollectorService] Falha ao construir fallback de vendas das coletas:', err)
    }

    const result = { byMlbId, byTitle, adByMlbId }
    // Aplicação da política LRU: se o cache excedeu o limite máximo, remove o item mais antigo
    if (this._fallbackMapCache.has(cacheKey)) {
      this._fallbackMapCache.delete(cacheKey)
    } else if (this._fallbackMapCache.size >= this._MAX_CACHE_ENTRIES) {
      const oldestKey = this._fallbackMapCache.keys().next().value
      if (oldestKey !== undefined) {
        this._fallbackMapCache.delete(oldestKey)
      }
    }
    this._fallbackMapCache.set(cacheKey, { timestamp: Date.now(), data: result })
    return result
  },

  /**
   * Helper para verificar se o erro é de autenticação/sessão expirada
   */
  isAuthError(err: any): boolean {
    if (!err) return false
    const status = err.status || err.statusCode || (err.response && err.response.status)
    if (status === 401 || status === 403) return true
    const msg = (err.message || '').toLowerCase()
    if (
      msg.includes('token') ||
      msg.includes('authenticate') ||
      msg.includes('unauthorized') ||
      msg.includes('forbidden') ||
      msg.includes('failed to authenticate') ||
      msg.includes('only authenticated users')
    ) {
      return true
    }
    // Erro 400 com mensagem de regra de acesso ou token
    if (
      status === 400 &&
      (msg.includes('failed to create record') || msg.includes('something went wrong')) &&
      !pb.authStore.isValid
    ) {
      return true
    }
    return false
  },

  /**
   * Lista o histórico recente de coletas.
   * Em caso de erro de autenticação (401/403/sessão expirada), relança o erro para que
   * a interface exiba o estado honesto de autenticação em vez de uma lista vazia silenciosa.
   */
  async listRecentImports(limit = 30): Promise<MLCollectorImportRecord[]> {
    // Se a sessão local já for inválida, falhar explicitamente
    if (!pb.authStore.isValid || !pb.authStore.record?.id) {
      const authErr = new Error(
        'Sessão expirada. Faça login novamente para visualizar o histórico de coletas.',
      )
      ;(authErr as any).status = 401
      throw authErr
    }

    try {
      const records = await pb
        .collection('ml_collector_imports')
        .getList<MLCollectorImportRecord>(1, limit, {
          filter: 'search_term != "busca mercado livre" && search_term != "pl"',
          sort: '-imported_at',
        })
      const cleanItems = (records.items || []).filter(
        (rec) => !isDirtyCollectorTerm(rec.search_term),
      )
      return cleanItems
    } catch (err: any) {
      console.warn('[mlCollectorService] Erro ao listar coletas:', err)
      if (this.isAuthError(err)) {
        throw err
      }
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

  /**
   * Obtém ou gera uma chave de coleta para o usuário autenticado ou para a aplicação.
   * Se o usuário não estiver autenticado ou a chamada falhar por auth, RELANÇA o erro
   * em vez de retornar silenciosamente 'mlk_default_...'.
   */
  async getOrCreateCollectorKey(userId?: string): Promise<string> {
    const effectiveUserId = userId || pb.authStore.record?.id

    if (!pb.authStore.isValid || !effectiveUserId) {
      const authErr = new Error('Sessão expirada. Faça login para carregar sua chave de coleta.')
      ;(authErr as any).status = 401
      throw authErr
    }

    try {
      // 1. Tenta buscar chave ativa do próprio usuário primeiro
      const userFilter = `user_id = "${effectiveUserId}" && active = true`
      const records = await pb.collection('ml_collector_keys').getList<MLCollectorKeyRecord>(1, 1, {
        filter: userFilter,
      })

      if (records.items && records.items.length > 0) {
        return records.items[0].key
      }

      // 2. Se for admin e não achou chave específica do user, tenta qualquer chave ativa
      if (pb.authStore.record?.role === 'admin') {
        const generalRecords = await pb
          .collection('ml_collector_keys')
          .getList<MLCollectorKeyRecord>(1, 1, {
            filter: 'active = true',
          })
        if (generalRecords.items && generalRecords.items.length > 0) {
          return generalRecords.items[0].key
        }
      }

      // 3. Se não existir, gera uma chave aleatória segura vinculada ao usuário
      const randomKey =
        'mlk_' +
        Math.random().toString(36).substring(2, 10) +
        Date.now().toString(36) +
        Math.random().toString(36).substring(2, 6)

      const created = await pb.collection('ml_collector_keys').create<MLCollectorKeyRecord>({
        key: randomKey,
        name:
          'Chave do Coletor - ' +
          (pb.authStore.record?.name || pb.authStore.record?.email || 'Usuário'),
        user_id: effectiveUserId,
        active: true,
      })

      return created.key
    } catch (err: any) {
      console.warn('[mlCollectorService] Erro ao obter chave de coleta:', err)
      if (this.isAuthError(err)) {
        throw err
      }
      throw new Error(err.message || 'Falha ao obter ou registrar chave de coleta.')
    }
  },

  /**
   * Extração taxonômica fina de especificações para agrupamento justo (DDR, GB, MHz, Formato, etc)
   */
  /**
   * Tenta encontrar uma sold_quantity de fallback para um item de catálogo
   * comparando MLB IDs ou similaridade de título com as coletas salvas do navegador.
   */
  matchFallbackSoldQuantity(
    item: {
      id?: string
      catalog_product_id?: string
      buy_box_winner_item_id?: string
      title?: string
      sold_quantity?: number | null
      competitors?: Array<{ item_id?: string }>
    },
    fallbackMap: {
      byMlbId: Map<string, number>
      byTitle: Map<string, number>
      adByMlbId?: Map<string, CollectorDeduplicatedAd>
    },
  ): number | null {
    if (!fallbackMap) return null

    // 1. Verificar por ID do produto ou do vencedor da Buy Box (com e sem prefixo MLB)
    const rawCandidateIds = [
      item.id,
      item.catalog_product_id,
      item.buy_box_winner_item_id,
      ...(Array.isArray(item.competitors) ? item.competitors.map((c) => c.item_id) : []),
    ].filter(Boolean) as string[]

    const candidateIds: string[] = []
    for (const raw of rawCandidateIds) {
      const clean = String(raw)
        .replace(/[^0-9A-Za-z]/g, '')
        .toUpperCase()
      if (clean) {
        candidateIds.push(clean)
        if (clean.startsWith('MLB')) {
          candidateIds.push(clean.replace(/^MLB/, ''))
        } else {
          candidateIds.push(`MLB${clean}`)
        }
      }
    }

    for (const cand of candidateIds) {
      if (cand && fallbackMap.byMlbId.has(cand)) {
        const found = fallbackMap.byMlbId.get(cand)
        if (found && found > 0) return found
      }
    }

    // 2. Verificar por título exato normalizado
    if (item.title) {
      const cleanTitle = String(item.title)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

      if (fallbackMap.byTitle.has(cleanTitle)) {
        return fallbackMap.byTitle.get(cleanTitle) || null
      }

      // 3. Verificar por contenção mútua de título
      if (cleanTitle.length >= 8) {
        let bestSold: number | null = null
        for (const [collTitle, sQty] of fallbackMap.byTitle.entries()) {
          if (collTitle.length < 8) continue
          if (collTitle.includes(cleanTitle) || cleanTitle.includes(collTitle)) {
            if (bestSold == null || sQty > bestSold) {
              bestSold = sQty
            }
          }
        }
        if (bestSold != null) return bestSold
      }
    }

    return null
  },

  /**
   * Tenta encontrar o anúncio correspondente completo do coletor por MLB ID
   */
  matchFallbackAd(
    item: {
      id?: string
      catalog_product_id?: string
      buy_box_winner_item_id?: string
      competitors?: Array<{ item_id?: string }>
    },
    fallbackMap: {
      adByMlbId?: Map<string, CollectorDeduplicatedAd>
    },
  ): CollectorDeduplicatedAd | null {
    if (!fallbackMap || !fallbackMap.adByMlbId) return null

    const rawCandidateIds = [
      item.id,
      item.catalog_product_id,
      item.buy_box_winner_item_id,
      ...(Array.isArray(item.competitors) ? item.competitors.map((c) => c.item_id) : []),
    ].filter(Boolean) as string[]

    const candidateIds: string[] = []
    for (const raw of rawCandidateIds) {
      const clean = String(raw)
        .replace(/[^0-9A-Za-z]/g, '')
        .toUpperCase()
      if (clean) {
        candidateIds.push(clean)
        if (clean.startsWith('MLB')) {
          candidateIds.push(clean.replace(/^MLB/, ''))
        } else {
          candidateIds.push(`MLB${clean}`)
        }
      }
    }

    for (const cand of candidateIds) {
      if (cand && fallbackMap.adByMlbId.has(cand)) {
        const found = fallbackMap.adByMlbId.get(cand)
        if (found) return found
      }
    }

    return null
  },

  extractFineSpec(title: string): string {
    const cleanTitle = (title || '').trim()
    if (!cleanTitle) return 'Outros'

    // 1. Identificar geração de memória RAM (DDR2, DDR3, DDR3L, DDR4, DDR5, PC2, PC3, PC3L, PC4)
    const ddrMatch = cleanTitle.match(
      /\b(ddr\s*5|ddr\s*4|ddr\s*3\s*l|ddr\s*3|ddr\s*2|pc\s*5|pc\s*4|pc\s*3\s*l|pc\s*3|pc\s*2)\b/i,
    )

    // 2. Identificar capacidade (ex: 2GB, 4GB, 8GB, 16GB, 32GB, 64GB) ou Kit (ex: 2x8gb, 2x4gb)
    const kitMatch = cleanTitle.match(/\b(\d+)\s*[xX*]\s*(\d+)\s*(?:gb|gigas?)\b/i)
    const capMatch = cleanTitle.match(/\b(\d+)\s*(?:gb|gigas?)\b/i)

    // 3. Identificar frequência em MHz (ex: 667, 800, 1066, 1333, 1600, 1866, 2133, 2400, 2666, 2933, 3000, 3200, 3600, 4800, 5200, 5600, 6000)
    const mhzMatch = cleanTitle.match(
      /\b(667|800|1066|1333|1600|1866|2133|2400|2666|2933|3000|3200|3600|4800|5200|5600|6000)\s*(?:mhz)?\b/i,
    )

    // 4. Form factor / formato (SODIMM / Notebook / Laptop vs DIMM / Desktop)
    const isNotebook = /\b(sodimm|so-dimm|notebook|laptop|para\s+notebook)\b/i.test(cleanTitle)
    const isDesktop = /\b(dimm|udimm|desktop|pc\s+desktop|para\s+pc)\b/i.test(cleanTitle)

    let formTag = ''
    if (isNotebook) formTag = ' SODIMM'
    else if (isDesktop) formTag = ' Desktop'

    if (ddrMatch || capMatch) {
      let ddr = ddrMatch ? ddrMatch[0].toUpperCase().replace(/\s+/g, '') : 'RAM'
      // Normalizar PC3L -> DDR3L, PC4 -> DDR4 etc
      if (ddr === 'PC3L') ddr = 'DDR3L'
      else if (ddr === 'PC3') ddr = 'DDR3'
      else if (ddr === 'PC4') ddr = 'DDR4'
      else if (ddr === 'PC5') ddr = 'DDR5'
      else if (ddr === 'PC2') ddr = 'DDR2'

      let cap = ''
      if (kitMatch) {
        cap = `${kitMatch[1]}x${kitMatch[2]}GB`
      } else if (capMatch) {
        cap = `${capMatch[1]}GB`
      }

      let freq = ''
      if (mhzMatch) {
        freq = `${mhzMatch[1]}MHz`
      } else {
        // Regra do usuário: anúncios sem frequência explícita viram "(freq. n/d)" em vez de misturar
        freq = '(freq. n/d)'
      }

      return `${ddr} ${cap} ${freq}${formTag}`.replace(/\s+/g, ' ').trim()
    }

    // Processadores (ex: i3, i5, i7, i9 com geração ou modelo, Ryzen 5 5600g etc)
    const cpuIntelMatch = cleanTitle.match(/\b(core\s+)?(i[3579])[- ]?(\d{3,5}[a-z]{0,2})\b/i)
    if (cpuIntelMatch) {
      return `Intel ${cpuIntelMatch[2].toUpperCase()}-${cpuIntelMatch[3].toUpperCase()}`
    }
    const cpuAmdMatch = cleanTitle.match(/\b(ryzen\s+[3579])\s*(\d{4}[a-z]{0,2})\b/i)
    if (cpuAmdMatch) {
      return `AMD ${cpuAmdMatch[1].toUpperCase()} ${cpuAmdMatch[2].toUpperCase()}`
    }

    // Armazenamento SSD / HD
    const storageMatch = cleanTitle.match(/\b(ssd|nvme|m\.2|hd|disco\s+rigido)\b/i)
    const storageCap = cleanTitle.match(/\b(\d+)\s*(?:gb|tb)\b/i)
    if (storageMatch && storageCap) {
      const type = storageMatch[1].toUpperCase().replace(/\./g, '')
      const cap = storageCap[0].toUpperCase().replace(/\s+/g, '')
      return `${type} ${cap}`
    }

    // Form factor de gabinetes / computadores (SFF, Tiny, Mini, Micro, Desktop)
    const formMatch = cleanTitle.match(/\b(sff|tiny|mini|micro|usff|desktop|ultrabook)\b/i)
    if (formMatch) {
      return formMatch[1].toUpperCase()
    }

    return 'Outras Especificações'
  },

  /**
   * Helper para decodificar o payload caso o SDK venha como string, objeto ou array de bytes
   */
  decodePayload(rawPayload: any): MLCollectorPayload | null {
    if (!rawPayload) return null
    if (
      typeof rawPayload === 'object' &&
      !Array.isArray(rawPayload) &&
      Array.isArray(rawPayload.results)
    ) {
      return rawPayload as MLCollectorPayload
    }
    if (typeof rawPayload === 'string') {
      try {
        return JSON.parse(rawPayload)
      } catch (_) {
        return null
      }
    }
    if (Array.isArray(rawPayload)) {
      try {
        let res = ''
        const chunk = 8192
        for (let i = 0; i < rawPayload.length; i += chunk) {
          const slice = rawPayload.slice(i, i + chunk)
          res += String.fromCharCode.apply(null, slice)
        }
        return JSON.parse(decodeURIComponent(escape(res)))
      } catch (_) {
        try {
          let str = ''
          for (let b = 0; b < rawPayload.length; b++) str += String.fromCharCode(rawPayload[b])
          return JSON.parse(str)
        } catch (__) {
          return null
        }
      }
    }
    return null
  },

  /**
   * Obtém o resumo consolidado e deduplicado de coletas do termo informado
   * Tenta primeiro a rota nativa /backend/v1/custom/ml-collector/summary
   * e faz fallback de cálculo client-side completo caso a rota falhe.
   */
  async getCollectorSummaryReport(
    searchTerm: string,
    overridesParam?: Record<string, PositionOverrideAction>,
  ): Promise<CollectorSummaryReport | null> {
    const term = normalizeSearchTerm(searchTerm)
    if (!term) return null

    // Deduplicação de requisições em trânsito: mesmo termo = mesma Promise reaproveitada
    const cacheKey = `summary_report:${term}`
    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey)!
    }

    // AbortController para cancelar requisição anterior quando o termo muda
    if (activeSearchAbortController) {
      try {
        activeSearchAbortController.abort()
      } catch {
        /* intentionally ignored */
      }
    }
    const abortCtrl = new AbortController()
    activeSearchAbortController = abortCtrl
    const currentSignal = abortCtrl.signal

    const promise = (async (): Promise<CollectorSummaryReport | null> => {
      // 1. Obter overrides do usuário para o termo (caso não fornecidos)
      let overrides = overridesParam
      if (!overrides) {
        try {
          overrides = await positionOverridesService.getOverridesForTerm(term)
        } catch {
          overrides = {}
        }
      }

      if (currentSignal.aborted) return null

      // 2. Tentar endpoint dedicado no backend com passagem de overrides se possível
      try {
        const resp = await pb.send<CollectorSummaryReport>(
          `/backend/v1/custom/ml-collector/summary?term=${encodeURIComponent(term)}`,
          {
            method: 'GET',
            signal: currentSignal,
          },
        )
        if (currentSignal.aborted) return null

        // Se a rota backend retornou, aplicamos ainda a sanitização de ruído e overrides no cliente
        // para garantir sincronia instantânea e precisa mesmo se o backend estiver em versão anterior
        if (resp && resp.ok && resp.all_deduplicated_ads && resp.all_deduplicated_ads.length > 0) {
          return this.filterAndRecalculateReport(resp, term, overrides)
        }
        if (resp && resp.ok && resp.total_deduplicated_ads > 0) {
          return resp
        }
      } catch (err: any) {
        if (err?.name === 'AbortError' || currentSignal.aborted) {
          return null
        }
        console.warn(
          '[mlCollectorService] Falha ao consultar endpoint de resumo, rodando agregação local:',
          err,
        )
      }

      if (currentSignal.aborted) return null

      // 3. Fallback de agregação client-side completa
      // perPage reduzido de 50 para 15 conforme plano de mitigação
      const COLLECTOR_PAGE_SIZE = 15

      try {
        // Cascata inteligente: termo normalizado -> termo suavizado -> tokens significativos (AND)
        const candidates = [term]
        const softened = normalizeSearchTerm(softenSearchTerm(term))
        if (softened && softened !== term) {
          candidates.push(softened)
        }

        let collectedList: MLCollectorImportRecord[] = []

        // 1. Tentar cada candidato em exato e por contém
        for (const cand of candidates) {
          if (collectedList.length > 0) break
          try {
            const exactRes = await pb
              .collection('ml_collector_imports')
              .getList<MLCollectorImportRecord>(1, COLLECTOR_PAGE_SIZE, {
                filter: `search_term = "${cand}"`,
                sort: '-imported_at',
                signal: currentSignal,
              })
            const validExact = (exactRes.items || []).filter(
              (rec) =>
                !isDirtyCollectorTerm(rec.search_term) &&
                isCollectorTermCompatible(term, rec.search_term),
            )
            if (validExact.length > 0) {
              collectedList = validExact
              break
            }
          } catch {
            /* intentionally ignored */
          }

          try {
            const likeRes = await pb
              .collection('ml_collector_imports')
              .getList<MLCollectorImportRecord>(1, COLLECTOR_PAGE_SIZE, {
                filter: `search_term ~ "${cand}"`,
                sort: '-imported_at',
                signal: currentSignal,
              })
            const validLike = (likeRes.items || []).filter(
              (rec) =>
                !isDirtyCollectorTerm(rec.search_term) &&
                isCollectorTermCompatible(term, rec.search_term),
            )
            if (validLike.length > 0) {
              collectedList = validLike
              break
            }
          } catch {
            /* intentionally ignored */
          }
        }

        // 2. Se ainda vazio, tentar pelos tokens significativos (AND obrigatório)
        if (collectedList.length === 0) {
          const activeSource = candidates[candidates.length - 1]
          const tokens = activeSource.split(/\s+/).filter((t) => t.length >= 3)
          if (tokens.length > 0) {
            const tokenFilter = tokens.map((t) => `search_term ~ "${t}"`).join(' && ')
            try {
              const tokenRes = await pb
                .collection('ml_collector_imports')
                .getList<MLCollectorImportRecord>(1, COLLECTOR_PAGE_SIZE, {
                  filter: tokenFilter,
                  sort: '-imported_at',
                  signal: currentSignal,
                })
              const validTokens = (tokenRes.items || []).filter(
                (rec) =>
                  !isDirtyCollectorTerm(rec.search_term) &&
                  isCollectorTermCompatible(term, rec.search_term),
              )
              if (validTokens.length > 0) {
                collectedList = validTokens
              }
            } catch {
              /* intentionally ignored */
            }
          }
        }

        if (collectedList.length === 0) {
          return null
        }

        // Filtrar estritamente apenas coletas cujo search_term seja compatível e não-sujo
        const compatibleItems = collectedList.filter(
          (rec) =>
            !isDirtyCollectorTerm(rec.search_term) &&
            isCollectorTermCompatible(term, rec.search_term),
        )
        if (compatibleItems.length === 0) {
          return null
        }

        const deduplicatedAds = new Map<string, CollectorDeduplicatedAd>()
        const importsList: Array<{
          id: string
          created: string
          source_url?: string
          results_count: number
          with_sales_count: number
        }> = []

        for (const rec of compatibleItems) {
          const payload = this.decodePayload(rec.payload)
          const items = payload && Array.isArray(payload.results) ? payload.results : []

          importsList.push({
            id: rec.id,
            created: rec.created || rec.imported_at || '',
            source_url: rec.source_url,
            results_count: items.length,
            with_sales_count: rec.with_sales_count || 0,
          })

          for (let i = 0; i < items.length; i++) {
            const it = items[i]
            const adId = (it.mlb_id || it.id || `ITEM_${i}`).trim()
            // Regra de Ouro da Tarefa: nunca inventar números; sem sold_quantity explícito (> 0 e número) não entra como vendido
            const soldQty =
              it.sold_quantity != null && !isNaN(Number(it.sold_quantity))
                ? Number(it.sold_quantity)
                : null
            const price =
              it.price != null && !isNaN(Number(it.price)) ? Number(it.price) : undefined
            const title = (it.title || '').trim()
            const seller = (it.seller_name || '').trim()
            const permalink = (it.permalink || '').trim()
            const thumbnail = (it.thumbnail || '').trim()
            const isFreeShipping = Boolean(it.is_free_shipping)
            const isFull = Boolean(it.is_full)
            const condition = (it.condition || '').trim()

            const detectedSubfamily = (it as any).subfamily || (it as any).subfamily_name || ''
            if (!deduplicatedAds.has(adId)) {
              deduplicatedAds.set(adId, {
                id: adId,
                mlb_id: it.mlb_id || adId,
                title,
                price,
                sold_quantity: soldQty,
                seller_name: seller,
                permalink,
                thumbnail,
                is_free_shipping: isFreeShipping,
                is_full: isFull,
                condition,
                subfamily: detectedSubfamily,
              })
            } else {
              // Deduplicação por mlb_id mantendo SEMPRE a MAIOR sold_quantity observada
              const exist = deduplicatedAds.get(adId)!
              if (soldQty != null) {
                if (exist.sold_quantity == null || soldQty > exist.sold_quantity) {
                  exist.sold_quantity = soldQty
                }
              }
              if ((!exist.price || exist.price <= 0) && price && price > 0) exist.price = price
              if (!exist.seller_name && seller) exist.seller_name = seller
              if (!exist.permalink && permalink) exist.permalink = permalink
              if (!exist.title && title) exist.title = title
              if (!exist.thumbnail && thumbnail) exist.thumbnail = thumbnail
            }
          }
        }

        const rawAllAds = Array.from(deduplicatedAds.values())
        const noiseAdsList: CollectorDeduplicatedAd[] = []
        let manuallyExcludedCount = 0
        let manuallyIncludedCount = 0

        // Aplicar filtro de relevância (heurística + overrides manuais do usuário)
        const filteredAds: CollectorDeduplicatedAd[] = []
        for (const ad of rawAllAds) {
          const adId = ad.id || ad.mlb_id
          const override = overrides ? overrides[adId] : undefined

          if (override === 'exclude') {
            manuallyExcludedCount++
            noiseAdsList.push(ad)
            continue
          }

          if (override === 'include') {
            manuallyIncludedCount++
            filteredAds.push(ad)
            continue
          }

          // Heurística de ruído automático
          const noiseCheck = detectCollectorNoiseAd(ad.title, term)
          if (noiseCheck.isNoise) {
            noiseAdsList.push(ad)
            continue
          }

          filteredAds.push(ad)
        }

        const allAds = filteredAds
        const adsWithSales = allAds.filter((a) => a.sold_quantity != null && a.sold_quantity > 0)
        adsWithSales.sort((a, b) => (b.sold_quantity || 0) - (a.sold_quantity || 0))

        let totalSoldUnits = 0
        let totalSalesRevenue = 0
        const pricesWithSales: number[] = []

        for (const adItem of adsWithSales) {
          const qty = adItem.sold_quantity || 0
          totalSoldUnits += qty
          if (adItem.price && adItem.price > 0) {
            totalSalesRevenue += adItem.price * qty
            pricesWithSales.push(adItem.price)
          }
        }

        pricesWithSales.sort((a, b) => a - b)
        const simpleAvgPrice =
          pricesWithSales.length > 0
            ? pricesWithSales.reduce((s, p) => s + p, 0) / pricesWithSales.length
            : 0
        const weightedAvgPrice = totalSoldUnits > 0 ? totalSalesRevenue / totalSoldUnits : 0
        const medianPrice =
          pricesWithSales.length > 0
            ? pricesWithSales.length % 2 === 0
              ? (pricesWithSales[pricesWithSales.length / 2 - 1] +
                  pricesWithSales[pricesWithSales.length / 2]) /
                2
              : pricesWithSales[Math.floor(pricesWithSales.length / 2)]
            : 0

        const minPriceWithSales = pricesWithSales.length > 0 ? pricesWithSales[0] : 0
        const maxPriceWithSales =
          pricesWithSales.length > 0 ? pricesWithSales[pricesWithSales.length - 1] : 0

        // Agrupamento por especificação fina cobrindo TODOS os anúncios (com vendas E sem vendas)
        const specMap = new Map<
          string,
          {
            spec: string
            totalUnits: number
            totalRevenue: number
            adCount: number
            adsWithSalesCount: number
            adsWithoutSalesCount: number
            pricesWithSales: number[]
            ads: CollectorDeduplicatedAd[]
          }
        >()

        for (const ad of allAds) {
          const specKey = this.extractFineSpec(ad.title)

          if (!specMap.has(specKey)) {
            specMap.set(specKey, {
              spec: specKey,
              totalUnits: 0,
              totalRevenue: 0,
              adCount: 0,
              adsWithSalesCount: 0,
              adsWithoutSalesCount: 0,
              pricesWithSales: [],
              ads: [],
            })
          }

          const sp = specMap.get(specKey)!
          sp.adCount += 1
          sp.ads.push(ad)

          const soldQty = ad.sold_quantity != null && ad.sold_quantity > 0 ? ad.sold_quantity : 0
          if (soldQty > 0) {
            sp.adsWithSalesCount += 1
            sp.totalUnits += soldQty
            if (ad.price && ad.price > 0) {
              sp.totalRevenue += ad.price * soldQty
              sp.pricesWithSales.push(ad.price)
            }
          } else {
            sp.adsWithoutSalesCount += 1
          }
        }

        const allSpecsRanked: CollectorSpecMetrics[] = Array.from(specMap.values()).map((sp) => {
          sp.pricesWithSales.sort((a, b) => a - b)
          const count = sp.pricesWithSales.length
          const simpleAvg = count > 0 ? sp.pricesWithSales.reduce((s, p) => s + p, 0) / count : 0
          const weightedAvg = sp.totalUnits > 0 ? sp.totalRevenue / sp.totalUnits : 0
          const median =
            count > 0
              ? count % 2 === 0
                ? (sp.pricesWithSales[count / 2 - 1] + sp.pricesWithSales[count / 2]) / 2
                : sp.pricesWithSales[Math.floor(count / 2)]
              : 0

          const min = count > 0 ? sp.pricesWithSales[0] : 0
          const max = count > 0 ? sp.pricesWithSales[count - 1] : 0

          const share =
            totalSoldUnits > 0 ? Math.round((sp.totalUnits / totalSoldUnits) * 1000) / 10 : 0

          // Anúncio campeão da especificação
          const specAdsWithSales = sp.ads.filter(
            (a) => a.sold_quantity != null && a.sold_quantity > 0,
          )
          specAdsWithSales.sort((a, b) => (b.sold_quantity || 0) - (a.sold_quantity || 0))
          const champion =
            specAdsWithSales.length > 0 ? specAdsWithSales[0] : sp.ads.length > 0 ? sp.ads[0] : null

          return {
            spec: sp.spec,
            totalUnits: sp.totalUnits,
            totalRevenue: Math.round(sp.totalRevenue * 100) / 100,
            adCount: sp.adCount,
            adsWithSalesCount: sp.adsWithSalesCount,
            adsWithoutSalesCount: sp.adsWithoutSalesCount,
            weightedAvgPrice: Math.round(weightedAvg * 100) / 100,
            simpleAvgPrice: Math.round(simpleAvg * 100) / 100,
            medianPrice: Math.round(median * 100) / 100,
            minPrice: min,
            maxPrice: max,
            sharePercent: share,
            championAd: champion,
            ads: sp.ads,
          }
        })

        // Ordenar por volume de unidades vendidas decrescente; desempate por contagem de anúncios
        allSpecsRanked.sort((a, b) => {
          if (b.totalUnits !== a.totalUnits) return b.totalUnits - a.totalUnits
          return b.adCount - a.adCount
        })

        return {
          ok: true,
          term,
          imports_count: compatibleItems.length,
          imports: importsList,
          total_deduplicated_ads: allAds.length,
          ads_with_sales_count: adsWithSales.length,
          total_sold_units: totalSoldUnits,
          weighted_avg_price: Math.round(weightedAvgPrice * 100) / 100,
          simple_avg_price: Math.round(simpleAvgPrice * 100) / 100,
          median_price: Math.round(medianPrice * 100) / 100,
          min_price: minPriceWithSales,
          max_price: maxPriceWithSales,
          champion_ad: adsWithSales.length > 0 ? adsWithSales[0] : null,
          top_ads: adsWithSales.slice(0, 10),
          top_specs: allSpecsRanked.slice(0, 8),
          all_specs: allSpecsRanked,
          all_deduplicated_ads: allAds,
          noise_ads_count: noiseAdsList.length,
          noise_ads: noiseAdsList,
          manually_excluded_count: manuallyExcludedCount,
          manually_included_count: manuallyIncludedCount,
          raw_total_ads_count: rawAllAds.length,
        }
      } catch (err: any) {
        if (err?.name === 'AbortError' || currentSignal.aborted) {
          return null
        }
        console.warn('[mlCollectorService] Erro na agregação local:', err)
        return null
      }
    })().finally(() => {
      inFlightRequests.delete(cacheKey)
      if (activeSearchAbortController === abortCtrl) {
        activeSearchAbortController = null
      }
    })

    inFlightRequests.set(cacheKey, promise)
    return promise
  },

  /**
   * Sanitiza e recalcula um relatório existente aplicando heurística de ruído e overrides
   */
  filterAndRecalculateReport(
    report: CollectorSummaryReport,
    term: string,
    overrides?: Record<string, PositionOverrideAction>,
  ): CollectorSummaryReport {
    const rawAds = report.all_deduplicated_ads || []
    if (rawAds.length === 0) return report

    const noiseAdsList: CollectorDeduplicatedAd[] = []
    let manuallyExcludedCount = 0
    let manuallyIncludedCount = 0
    const filteredAds: CollectorDeduplicatedAd[] = []

    for (const ad of rawAds) {
      const adId = ad.id || ad.mlb_id
      const override = overrides ? overrides[adId] : undefined

      if (override === 'exclude') {
        manuallyExcludedCount++
        noiseAdsList.push(ad)
        continue
      }

      if (override === 'include') {
        manuallyIncludedCount++
        filteredAds.push(ad)
        continue
      }

      const noiseCheck = detectCollectorNoiseAd(ad.title, term)
      if (noiseCheck.isNoise) {
        noiseAdsList.push(ad)
        continue
      }

      filteredAds.push(ad)
    }

    const adsWithSales = filteredAds.filter((a) => a.sold_quantity != null && a.sold_quantity > 0)
    adsWithSales.sort((a, b) => (b.sold_quantity || 0) - (a.sold_quantity || 0))

    let totalSoldUnits = 0
    let totalSalesRevenue = 0
    const pricesWithSales: number[] = []

    for (const adItem of adsWithSales) {
      const qty = adItem.sold_quantity || 0
      totalSoldUnits += qty
      if (adItem.price && adItem.price > 0) {
        totalSalesRevenue += adItem.price * qty
        pricesWithSales.push(adItem.price)
      }
    }

    pricesWithSales.sort((a, b) => a - b)
    const simpleAvgPrice =
      pricesWithSales.length > 0
        ? pricesWithSales.reduce((s, p) => s + p, 0) / pricesWithSales.length
        : 0
    const weightedAvgPrice = totalSoldUnits > 0 ? totalSalesRevenue / totalSoldUnits : 0
    const medianPrice =
      pricesWithSales.length > 0
        ? pricesWithSales.length % 2 === 0
          ? (pricesWithSales[pricesWithSales.length / 2 - 1] +
              pricesWithSales[pricesWithSales.length / 2]) /
            2
          : pricesWithSales[Math.floor(pricesWithSales.length / 2)]
        : 0

    const minPriceWithSales = pricesWithSales.length > 0 ? pricesWithSales[0] : 0
    const maxPriceWithSales =
      pricesWithSales.length > 0 ? pricesWithSales[pricesWithSales.length - 1] : 0

    const specMap = new Map<
      string,
      {
        spec: string
        totalUnits: number
        totalRevenue: number
        adCount: number
        adsWithSalesCount: number
        adsWithoutSalesCount: number
        pricesWithSales: number[]
        ads: CollectorDeduplicatedAd[]
      }
    >()

    for (const ad of filteredAds) {
      const specKey = this.extractFineSpec(ad.title)

      if (!specMap.has(specKey)) {
        specMap.set(specKey, {
          spec: specKey,
          totalUnits: 0,
          totalRevenue: 0,
          adCount: 0,
          adsWithSalesCount: 0,
          adsWithoutSalesCount: 0,
          pricesWithSales: [],
          ads: [],
        })
      }

      const sp = specMap.get(specKey)!
      sp.adCount += 1
      sp.ads.push(ad)

      const soldQty = ad.sold_quantity != null && ad.sold_quantity > 0 ? ad.sold_quantity : 0
      if (soldQty > 0) {
        sp.adsWithSalesCount += 1
        sp.totalUnits += soldQty
        if (ad.price && ad.price > 0) {
          sp.totalRevenue += ad.price * soldQty
          sp.pricesWithSales.push(ad.price)
        }
      } else {
        sp.adsWithoutSalesCount += 1
      }
    }

    const allSpecsRanked: CollectorSpecMetrics[] = Array.from(specMap.values()).map((sp) => {
      sp.pricesWithSales.sort((a, b) => a - b)
      const count = sp.pricesWithSales.length
      const simpleAvg = count > 0 ? sp.pricesWithSales.reduce((s, p) => s + p, 0) / count : 0
      const weightedAvg = sp.totalUnits > 0 ? sp.totalRevenue / sp.totalUnits : 0
      const median =
        count > 0
          ? count % 2 === 0
            ? (sp.pricesWithSales[count / 2 - 1] + sp.pricesWithSales[count / 2]) / 2
            : sp.pricesWithSales[Math.floor(count / 2)]
          : 0

      const min = count > 0 ? sp.pricesWithSales[0] : 0
      const max = count > 0 ? sp.pricesWithSales[count - 1] : 0

      const share =
        totalSoldUnits > 0 ? Math.round((sp.totalUnits / totalSoldUnits) * 1000) / 10 : 0

      const specAdsWithSales = sp.ads.filter((a) => a.sold_quantity != null && a.sold_quantity > 0)
      specAdsWithSales.sort((a, b) => (b.sold_quantity || 0) - (a.sold_quantity || 0))
      const champion =
        specAdsWithSales.length > 0 ? specAdsWithSales[0] : sp.ads.length > 0 ? sp.ads[0] : null

      return {
        spec: sp.spec,
        totalUnits: sp.totalUnits,
        totalRevenue: Math.round(sp.totalRevenue * 100) / 100,
        adCount: sp.adCount,
        adsWithSalesCount: sp.adsWithSalesCount,
        adsWithoutSalesCount: sp.adsWithoutSalesCount,
        weightedAvgPrice: Math.round(weightedAvg * 100) / 100,
        simpleAvgPrice: Math.round(simpleAvg * 100) / 100,
        medianPrice: Math.round(median * 100) / 100,
        minPrice: min,
        maxPrice: max,
        sharePercent: share,
        championAd: champion,
        ads: sp.ads,
      }
    })

    allSpecsRanked.sort((a, b) => {
      if (b.totalUnits !== a.totalUnits) return b.totalUnits - a.totalUnits
      return b.adCount - a.adCount
    })

    return {
      ...report,
      term,
      total_deduplicated_ads: filteredAds.length,
      ads_with_sales_count: adsWithSales.length,
      total_sold_units: totalSoldUnits,
      weighted_avg_price: Math.round(weightedAvgPrice * 100) / 100,
      simple_avg_price: Math.round(simpleAvgPrice * 100) / 100,
      median_price: Math.round(medianPrice * 100) / 100,
      min_price: minPriceWithSales,
      max_price: maxPriceWithSales,
      champion_ad: adsWithSales.length > 0 ? adsWithSales[0] : null,
      top_ads: adsWithSales.slice(0, 10),
      top_specs: allSpecsRanked.slice(0, 8),
      all_specs: allSpecsRanked,
      all_deduplicated_ads: filteredAds,
      noise_ads_count: noiseAdsList.length,
      noise_ads: noiseAdsList,
      manually_excluded_count: manuallyExcludedCount,
      manually_included_count: manuallyIncludedCount,
      raw_total_ads_count: rawAds.length,
    }
  },

  /**
   * Remove um item específico de uma coleta importada pelo ID
   */
  async removeItemFromImport(importId: string, itemMlbIdOrId: string): Promise<boolean> {
    try {
      const record = await pb
        .collection('ml_collector_imports')
        .getOne<MLCollectorImportRecord>(importId)
      if (!record || !record.payload) return false

      const payload = this.decodePayload(record.payload)
      if (!payload || !Array.isArray(payload.results)) return false

      const initialCount = payload.results.length
      const updatedResults = payload.results.filter(
        (it) => it.id !== itemMlbIdOrId && it.mlb_id !== itemMlbIdOrId,
      )

      if (updatedResults.length === initialCount) return false

      const withSales = updatedResults.filter(
        (it) => it.sold_quantity != null && it.sold_quantity > 0,
      ).length

      payload.results = updatedResults
      payload.results_count = updatedResults.length
      payload.with_sales_count = withSales

      const payloadToSave = typeof record.payload === 'string' ? JSON.stringify(payload) : payload

      await pb.collection('ml_collector_imports').update(importId, {
        payload: payloadToSave,
        results_count: updatedResults.length,
        with_sales_count: withSales,
      })

      return true
    } catch (err) {
      console.warn('[mlCollectorService] Erro ao remover item da coleta:', err)
      return false
    }
  },

  /**
   * Regenera a chave de coleta
   */
  async regenerateCollectorKey(userId?: string): Promise<string> {
    const effectiveUserId = userId || pb.authStore.record?.id

    if (!pb.authStore.isValid || !effectiveUserId) {
      const authErr = new Error('Sessão expirada. Faça login para regenerar sua chave.')
      ;(authErr as any).status = 401
      throw authErr
    }

    const randomKey =
      'mlk_' +
      Math.random().toString(36).substring(2, 10) +
      Date.now().toString(36) +
      Math.random().toString(36).substring(2, 6)

    try {
      const created = await pb.collection('ml_collector_keys').create<MLCollectorKeyRecord>({
        key: randomKey,
        name: 'Chave Regenerada ' + new Date().toLocaleDateString('pt-BR'),
        user_id: effectiveUserId,
        active: true,
      })
      return created.key
    } catch (err: any) {
      console.warn('[mlCollectorService] Erro ao regenerar chave:', err)
      if (this.isAuthError(err)) {
        throw err
      }
      throw new Error(err.message || 'Falha ao regenerar chave de coleta.')
    }
  },
}
