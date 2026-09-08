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
}

export interface CollectorTopSpec {
  spec: string
  totalUnits: number
  adCount: number
  weightedAvgPrice: number
}

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
  all_deduplicated_ads: CollectorDeduplicatedAd[]
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

    try {
      // 1. Tentar correspondência exata
      let records = await pb
        .collection('ml_collector_imports')
        .getList<MLCollectorImportRecord>(1, 1, {
          filter: `search_term = "${term}"`,
          sort: '-imported_at',
        })

      if (records && records.items && records.items.length > 0) {
        const item = records.items[0]
        if (item.payload) {
          item.payload = this.decodePayload(item.payload) || item.payload
        }
        return item
      }

      // 2. Tentar busca ampla por contém (ex: "memoria smart" casa com "memoria smartt")
      records = await pb.collection('ml_collector_imports').getList<MLCollectorImportRecord>(1, 1, {
        filter: `search_term ~ "${term}"`,
        sort: '-imported_at',
      })

      if (records && records.items && records.items.length > 0) {
        const item = records.items[0]
        if (item.payload) {
          item.payload = this.decodePayload(item.payload) || item.payload
        }
        return item
      }
    } catch (err) {
      console.warn('[mlCollectorService] Erro ao buscar coleta por termo:', err)
    }

    return null
  },

  /**
   * Lista o histórico recente de coletas
   */
  async listRecentImports(limit = 30): Promise<MLCollectorImportRecord[]> {
    try {
      const records = await pb
        .collection('ml_collector_imports')
        .getList<MLCollectorImportRecord>(1, limit, {
          sort: '-imported_at',
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

  /**
   * Obtém ou gera uma chave de coleta para o usuário autenticado ou para a aplicação
   */
  async getOrCreateCollectorKey(userId?: string): Promise<string> {
    try {
      const filter = userId ? `user_id = "${userId}" && active = true` : 'active = true'
      const records = await pb.collection('ml_collector_keys').getList<MLCollectorKeyRecord>(1, 1, {
        filter,
      })

      if (records.items && records.items.length > 0) {
        return records.items[0].key
      }

      // Se não existir, gera uma chave aleatória segura
      const randomKey =
        'mlk_' +
        Math.random().toString(36).substring(2, 10) +
        Date.now().toString(36) +
        Math.random().toString(36).substring(2, 6)

      const created = await pb.collection('ml_collector_keys').create<MLCollectorKeyRecord>({
        key: randomKey,
        name: 'Chave Padrão do Coletor',
        user_id: userId || pb.authStore.record?.id || '',
        active: true,
      })

      return created.key
    } catch (err) {
      console.warn('[mlCollectorService] Erro ao obter chave de coleta:', err)
      // Fallback para chave em memória/local caso o banco falhe
      return 'mlk_default_' + Date.now().toString(36)
    }
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
  async getCollectorSummaryReport(searchTerm: string): Promise<CollectorSummaryReport | null> {
    const term = normalizeSearchTerm(searchTerm)
    if (!term) return null

    // 1. Tentar endpoint dedicado no backend
    try {
      const resp = await pb.send<CollectorSummaryReport>(
        `/backend/v1/custom/ml-collector/summary?term=${encodeURIComponent(term)}`,
        { method: 'GET' },
      )
      if (resp && resp.ok && resp.total_deduplicated_ads > 0) {
        return resp
      }
    } catch (err) {
      console.warn(
        '[mlCollectorService] Falha ao consultar endpoint de resumo, rodando agregação local:',
        err,
      )
    }

    // 2. Fallback de agregação client-side
    try {
      // Buscar até 30 registros que contenham o termo
      const records = await pb
        .collection('ml_collector_imports')
        .getList<MLCollectorImportRecord>(1, 30, {
          filter: `search_term ~ "${term}"`,
          sort: '-imported_at',
        })

      if (!records || !records.items || records.items.length === 0) {
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

      for (const rec of records.items) {
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
          const soldQty = it.sold_quantity != null ? Number(it.sold_quantity) : null
          const price = it.price != null ? Number(it.price) : undefined
          const title = (it.title || '').trim()
          const seller = (it.seller_name || '').trim()
          const permalink = (it.permalink || '').trim()
          const thumbnail = (it.thumbnail || '').trim()
          const isFreeShipping = Boolean(it.is_free_shipping)
          const isFull = Boolean(it.is_full)
          const condition = (it.condition || '').trim()

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
            })
          } else {
            const exist = deduplicatedAds.get(adId)!
            if (soldQty != null && (exist.sold_quantity == null || soldQty > exist.sold_quantity)) {
              exist.sold_quantity = soldQty
            }
            if (!exist.price && price) exist.price = price
            if (!exist.seller_name && seller) exist.seller_name = seller
            if (!exist.permalink && permalink) exist.permalink = permalink
            if (!exist.title && title) exist.title = title
            if (!exist.thumbnail && thumbnail) exist.thumbnail = thumbnail
          }
        }
      }

      const allAds = Array.from(deduplicatedAds.values())
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

      // Agrupamento por especificação
      const specMap = new Map<
        string,
        { spec: string; totalUnits: number; revenue: number; adCount: number }
      >()

      for (const itemA of adsWithSales) {
        const ddrMatch = itemA.title.match(/\b(ddr\s*[2345]|pc\s*[2345])\b/i)
        const capMatch = itemA.title.match(/\b(\d+)\s*(?:gb|gigas?)\b/i)
        const mhzMatch = itemA.title.match(
          /\b(1333|1600|2133|2400|2666|3200|4800|5600)\s*(?:mhz)?\b/i,
        )

        let specKey = 'Outras'
        if (ddrMatch || capMatch) {
          const ddr = ddrMatch ? ddrMatch[0].toUpperCase().replace(/\s+/g, '') : 'RAM'
          const cap = capMatch ? capMatch[1] + 'GB' : ''
          const mhz = mhzMatch ? ' ' + mhzMatch[1] + 'MHz' : ''
          specKey = `${ddr} ${cap}${mhz}`.trim()
        }

        if (!specMap.has(specKey)) {
          specMap.set(specKey, {
            spec: specKey,
            totalUnits: 0,
            revenue: 0,
            adCount: 0,
          })
        }
        const sp = specMap.get(specKey)!
        const qty = itemA.sold_quantity || 0
        sp.totalUnits += qty
        sp.adCount += 1
        if (itemA.price && itemA.price > 0) {
          sp.revenue += itemA.price * qty
        }
      }

      const specsRanked: CollectorTopSpec[] = Array.from(specMap.values()).map((sp) => ({
        spec: sp.spec,
        totalUnits: sp.totalUnits,
        adCount: sp.adCount,
        weightedAvgPrice:
          sp.totalUnits > 0 ? Math.round((sp.revenue / sp.totalUnits) * 100) / 100 : 0,
      }))
      specsRanked.sort((a, b) => b.totalUnits - a.totalUnits)

      return {
        ok: true,
        term,
        imports_count: records.items.length,
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
        top_specs: specsRanked.slice(0, 8),
        all_deduplicated_ads: allAds,
      }
    } catch (err) {
      console.warn('[mlCollectorService] Erro na agregação local:', err)
      return null
    }
  },

  /**
   * Regenera a chave de coleta
   */
  async regenerateCollectorKey(userId?: string): Promise<string> {
    const randomKey =
      'mlk_' +
      Math.random().toString(36).substring(2, 10) +
      Date.now().toString(36) +
      Math.random().toString(36).substring(2, 6)

    try {
      const created = await pb.collection('ml_collector_keys').create<MLCollectorKeyRecord>({
        key: randomKey,
        name: 'Chave Regenerada ' + new Date().toLocaleDateString('pt-BR'),
        user_id: userId || pb.authStore.record?.id || '',
        active: true,
      })
      return created.key
    } catch (err) {
      console.warn('[mlCollectorService] Erro ao regenerar chave:', err)
      return randomKey
    }
  },
}
