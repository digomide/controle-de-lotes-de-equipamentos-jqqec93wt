/// <reference path="../pb_data/types.d.ts" />

/**
 * Hook de fila para busca profunda no catálogo do Mercado Livre com Busca em Leque (Fan-out)
 * Executa de forma assíncrona ao criar um registro em ml_catalog_search_jobs.
 * Implementa:
 * 1. Mineração antecipada da conta do vendedor (ml_ads_fetch_jobs e coleção products):
 *    - Anúncios próprios que já possuem catalog_product_id.
 *    - Casamento flexível por tokens de busca e condição solicitada (refurbished / used).
 *    - Enriquecimento completo via GET /products/{id} (fotos, Buy Box, GRADING).
 *    - Injeção das posições próprias no TOPO com `is_own_account: true` e `own_ad_id`.
 * 2. Busca em Leque (Fan-Out) Multidimensional:
 *    - Gera sub-consultas automáticas variando termos (termo completo, sem stopwords, marca+modelo, modelo numérico)
 *    - Variação de condição (com e sem palavra-chave de condição, priorizando a condição solicitada)
 *    - Variação de ordenações (padrão de relevância, price_asc, price_desc)
 *    - Cada sub-busca explora até 20 páginas (offset ~1.000, limite da API ML por consulta)
 *    - Deduplicação unificada por catalog_product_id acumulando além dos 1.000 itens
 * 3. Teto global de segurança e proteção anti-bloqueio:
 *    - Teto global configurável (ex.: 5.000 posições salvas / 150 páginas somadas)
 *    - Pequena pausa de 80ms entre requisições; em caso de 429 (rate limit), retry após espera
 * 4. Métricas e progresso transparente:
 *    - Reporta em tempo real qual sub-busca está rodando: "Varredura X de Y: 'query' (pág Z)... N anúncios únicos"
 *    - Paging enriquecido com total anunciado original, total único coletado, sub-buscas executadas e se há universo restante
 * 5. Gravação resiliente com quedas graduais de payload:
 *    - Salva até 4.000+ posições higienizadas sem estourar limites de memória ou BD
 */

onRecordAfterCreateSuccess((e) => {
  const rec = e.record
  const appId = $app

  rec.set('status', 'processing')
  rec.set('progress_text', 'Iniciando busca profunda no catálogo do Mercado Livre...')
  appId.save(rec)

  const queryRaw = (rec.getString('query') || '').trim()
  const rawDomain = (rec.getString('domain_id') || '').trim()
  // Se domain_id for vazio ou 'all', não fixar domínio; caso contrário usar o informado
  const domainId = rawDomain === 'all' || !rawDomain ? '' : rawDomain

  // Condição direcionada da busca ('all' | 'refurbished' | 'new' | 'used')
  const requestedConditionRaw = (rec.getString('condition') || '').trim().toLowerCase()
  const requestedCondition =
    requestedConditionRaw === 'refurbished' ||
    requestedConditionRaw === 'new' ||
    requestedConditionRaw === 'used'
      ? requestedConditionRaw
      : 'all'

  // Função interna para obter ou renovar token ML
  let token = ''
  try {
    const sRecords = appId.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (sRecords && sRecords.length > 0) {
      const s = sRecords[0]
      token = s.getString('access_token')
      const refreshToken = s.getString('refresh_token')
      const expiresAt = s.getDateTime('token_expires_at')
      const clientId = s.getString('client_id') || $os.getenv('ML_CLIENT_ID') || ''
      const clientSecret = s.getString('client_secret') || $os.getenv('ML_CLIENT_SECRET') || ''

      const now = new Date()
      const exp = expiresAt ? new Date(expiresAt.time()) : null
      const needRefresh = !token || (exp && exp.getTime() - now.getTime() < 5 * 60 * 1000)

      if (needRefresh && refreshToken && clientId && clientSecret) {
        try {
          const tRes = $http.send({
            url: 'https://api.mercadolibre.com/oauth/token',
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body:
              'grant_type=refresh_token&client_id=' +
              encodeURIComponent(clientId) +
              '&client_secret=' +
              encodeURIComponent(clientSecret) +
              '&refresh_token=' +
              encodeURIComponent(refreshToken),
            timeout: 15,
          })
          if (tRes.statusCode === 200) {
            const d = tRes.json
            token = d.access_token
            s.set('access_token', d.access_token)
            if (d.refresh_token) s.set('refresh_token', d.refresh_token)
            if (d.expires_in) {
              const newExp = new Date(Date.now() + d.expires_in * 1000)
              s.set('token_expires_at', newExp.toISOString().replace('T', ' ').substring(0, 19))
            }
            appId.save(s)
          }
        } catch (tErr) {
          console.warn('[ml_catalog_search] Erro ao renovar token ML:', tErr)
        }
      }
    }
  } catch (errAuth) {
    console.warn('[ml_catalog_search] Erro ao carregar ml_settings:', errAuth)
  }

  // Extrair ID direto se o usuário colou link ou MLB/MLB-P
  let directCatalogId = null
  const pMatch =
    queryRaw.match(/\/p\/(MLB[0-9]+)/i) ||
    queryRaw.match(/^(MLB[0-9]+)$/i) ||
    queryRaw.match(/^(MLB-P-[0-9]+)$/i)
  if (pMatch) {
    directCatalogId = pMatch[1].toUpperCase()
  }

  // Helper para pequenas pausas (anti rate-limit)
  function sleepMs(ms) {
    try {
      const target = Date.now() + ms
      while (Date.now() < target) {
        // busy wait no goja
      }
    } catch (_) {}
  }

  // Função robusta para extração da condição/classificação do produto de catálogo do Mercado Livre
  function extractProductCondition(prod) {
    if (!prod) return { condition: 'new', condition_label: 'Novo' }

    let gradeFound = ''

    // (1) Atributos GRADING, RECONDITIONED_STATUS, ITEM_CONDITION ou CONDITION no array attributes
    if (Array.isArray(prod.attributes)) {
      for (let a = 0; a < prod.attributes.length; a++) {
        const attr = prod.attributes[a]
        if (!attr || !attr.id) continue
        const attrIdUpper = String(attr.id).toUpperCase()
        const attrNameLower = String(attr.name || '').toLowerCase()
        const valName = String(attr.value_name || '').trim()
        const valId = String(attr.value_id || '').trim()

        if (
          attrIdUpper === 'GRADING' ||
          attrIdUpper === 'RECONDITIONED_STATUS' ||
          attrIdUpper === 'REFURBISHED_STATUS' ||
          attrNameLower.includes('recondicionado')
        ) {
          if (valName) {
            gradeFound = valName
          }
        }

        if (
          attrIdUpper === 'ITEM_CONDITION' ||
          attrIdUpper === 'CONDITION' ||
          attrIdUpper === 'PRODUCT_CONDITION'
        ) {
          const valLower = valName.toLowerCase()
          if (
            valId === '2230581' ||
            valLower.includes('recondicionado') ||
            valLower.includes('refurbished')
          ) {
            return {
              condition: 'refurbished',
              condition_label: 'Recondicionado',
              condition_grade: gradeFound || undefined,
            }
          }
          if (
            valId === '2230582' ||
            valLower === 'usado' ||
            valLower === 'used' ||
            valLower === 'segunda mão'
          ) {
            return {
              condition: 'used',
              condition_label: 'Usado',
              condition_grade: gradeFound || undefined,
            }
          }
        }
      }
    }

    // Se encontramos atributo oficial GRADING, é comprovadamente Recondicionado!
    if (gradeFound) {
      return {
        condition: 'refurbished',
        condition_label: 'Recondicionado',
        condition_grade: gradeFound,
      }
    }

    // (2) Presença do campo raiz refurbished_info
    if (prod.refurbished_info) {
      const titleLowerForGrade = String(prod.name || prod.title || '').toLowerCase()
      let inferredGrade = ''
      if (titleLowerForGrade.includes('excelente')) inferredGrade = 'Excelente'
      else if (titleLowerForGrade.includes('bom')) inferredGrade = 'Bom'
      else if (titleLowerForGrade.includes('aceit')) inferredGrade = 'Aceitável'

      return {
        condition: 'refurbished',
        condition_label: 'Recondicionado',
        condition_grade: inferredGrade || undefined,
      }
    }

    // (3) buy_box_winner.condition se presente
    if (prod.buy_box_winner && prod.buy_box_winner.condition) {
      const bbCond = String(prod.buy_box_winner.condition).toLowerCase().trim()
      if (bbCond === 'refurbished' || bbCond === 'recondicionado') {
        return {
          condition: 'refurbished',
          condition_label: 'Recondicionado',
          condition_grade: gradeFound || undefined,
        }
      }
      if (bbCond === 'used' || bbCond === 'usado') {
        return {
          condition: 'used',
          condition_label: 'Usado',
          condition_grade: gradeFound || undefined,
        }
      }
      if (bbCond === 'new' || bbCond === 'novo') {
        return { condition: 'new', condition_label: 'Novo' }
      }
    }

    // (4) Campo raiz condition (se retornado pela API)
    if (prod.condition) {
      const rootCond = String(prod.condition).toLowerCase().trim()
      if (rootCond === 'refurbished' || rootCond === 'recondicionado') {
        return {
          condition: 'refurbished',
          condition_label: 'Recondicionado',
          condition_grade: gradeFound || undefined,
        }
      }
      if (rootCond === 'used' || rootCond === 'usado') {
        return {
          condition: 'used',
          condition_label: 'Usado',
          condition_grade: gradeFound || undefined,
        }
      }
      if (rootCond === 'new' || rootCond === 'novo') {
        return { condition: 'new', condition_label: 'Novo' }
      }
    }

    // (5) Heurística por texto no nome/título ou tags
    const titleLower = String(prod.name || prod.title || '').toLowerCase()
    if (titleLower.includes('recondicionado') || titleLower.includes('refurbished')) {
      let inferredGrade = ''
      if (titleLower.includes('excelente')) inferredGrade = 'Excelente'
      else if (titleLower.includes('muito bom')) inferredGrade = 'Muito bom'
      else if (titleLower.includes('bom')) inferredGrade = 'Bom'
      else if (titleLower.includes('aceit')) inferredGrade = 'Aceitável'

      return {
        condition: 'refurbished',
        condition_label: 'Recondicionado',
        condition_grade: inferredGrade || undefined,
      }
    }
    if (titleLower.includes('usado') || titleLower.includes('seminovo')) {
      return { condition: 'used', condition_label: 'Usado' }
    }

    if (requestedCondition === 'used') {
      return { condition: 'unknown', condition_label: 'Condição não informada' }
    }

    // (6) Padrão canônico do catálogo oficial ML quando não especificado
    return { condition: 'new', condition_label: 'Novo' }
  }

  // Função auxiliar para extrair e normalizar dados de disputa/concorrência da Buy Box
  function extractCompetitionData(prod) {
    let bbPrice = null
    let minPrice = null
    let winnerSellerId = null
    let winnerItemId = null
    let winnerStock = null
    let stockStatus = 'Estoque não público'
    let competitionStatus = 'Sem concorrente ativo'

    if (prod.buy_box_winner) {
      const bb = prod.buy_box_winner
      if (bb.price && bb.price > 0) {
        bbPrice = Number(bb.price)
        minPrice = bbPrice
      }
      if (bb.seller_id) {
        winnerSellerId = String(bb.seller_id)
      }
      if (bb.item_id) {
        winnerItemId = String(bb.item_id)
      }
      if (bb.available_quantity != null && bb.available_quantity > 0) {
        winnerStock = Number(bb.available_quantity)
        stockStatus = winnerStock + ' un. em estoque'
      } else if (bb.price) {
        stockStatus = 'Pronta entrega (1+ un.)'
      }
      competitionStatus = 'Disputa ativa na Buy Box'
    } else if (prod.price && prod.price > 0) {
      bbPrice = Number(prod.price)
      minPrice = bbPrice
      competitionStatus = 'Preço de referência do catálogo'
      stockStatus = 'Estoque sob consulta'
    }

    return {
      buy_box_winner_price: bbPrice,
      min_price: minPrice,
      buy_box_winner_seller_id: winnerSellerId,
      buy_box_winner_item_id: winnerItemId,
      buy_box_winner_stock: winnerStock,
      stock_status: stockStatus,
      competition_status: competitionStatus,
    }
  }

  const debugLog = []
  const itemsFound = []
  const seenCatalogIds = {}
  let strategyUsed = 'none'

  // Métricas completas e honestas de varredura
  const pagingSummary = {
    total: 0,
    pages_fetched: 0,
    items_count: 0,
    sub_searches_total: 0,
    sub_searches_completed: 0,
    universe_estimated_total: 0,
    coverage_percentage: 0,
    has_uncovered_universe: false,
    max_cap_reached: false,
  }

  // Helper simples para normalizar texto e tokens
  function tokenizeText(text) {
    if (!text) return []
    const clean = String(text)
      .toLowerCase()
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
    const stopWords = {
      notebook: 1,
      notebooks: 1,
      laptop: 1,
      laptops: 1,
      pc: 1,
      computador: 1,
      de: 1,
      da: 1,
      do: 1,
      para: 1,
      com: 1,
      e: 1,
      todos: 1,
      todas: 1,
      recondicionado: 1,
      recondicionados: 1,
      refurbished: 1,
      usado: 1,
      usados: 1,
      novo: 1,
      novos: 1,
    }
    const words = clean.split(/\s+/).filter(Boolean)
    const filtered = words.filter(function (w) {
      return !stopWords[w]
    })
    return filtered.length > 0 ? filtered : words
  }

  try {
    // =========================================================================
    // ETAPA 0: MINERAÇÃO DE ANÚNCIOS PRÓPRIOS (ml_ads_fetch_jobs e products)
    // =========================================================================
    // Garante que posições recondicionadas/usadas que já existem na conta do vendedor
    // (ex.: Dell Latitude 5420 -> MLB2097858038) SEJAM SEMPRE ENCONTRADAS e colocadas
    // no TOPO absoluto com `is_own_account: true`.
    const queryTokens = tokenizeText(queryRaw)
    const ownCandidates = []
    const seenCandidateCatalogIds = {}

    debugLog.push(
      'Etapa 0: Minerando anúncios próprios para tokens: [' + queryTokens.join(', ') + ']',
    )

    // Função auxiliar robusta para testar se um texto normalizado casa com todos os tokens
    function matchesAllTokens(text, tokens) {
      if (!tokens || tokens.length === 0) return true
      const normText = String(text || '')
        .toLowerCase()
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[-_/\\,.;:|]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      const compactText = normText.replace(/[^a-z0-9]/g, '')

      for (let t = 0; t < tokens.length; t++) {
        const tok = tokens[t]
        if (!tok) continue
        const isNum = /^[0-9]+$/.test(tok)
        if (isNum) {
          const numRegex = new RegExp('(?<![0-9])' + tok + '(?![0-9])', 'i')
          if (!numRegex.test(normText)) {
            return false
          }
        } else {
          const wordRegex = new RegExp('\\b' + tok + '\\b', 'i')
          if (
            !wordRegex.test(normText) &&
            normText.indexOf(tok) === -1 &&
            compactText.indexOf(tok) === -1
          ) {
            return false
          }
        }
      }
      return true
    }

    // 0a. Minerar o último ml_ads_fetch_jobs com status='done'
    try {
      const adsJobs = appId.findRecordsByFilter(
        'ml_ads_fetch_jobs',
        "status = 'done' && items_count > 0",
        '-created',
        1,
        0,
      )
      if (adsJobs && adsJobs.length > 0) {
        let rawAdsItems = adsJobs[0].getString('items')
        if (!rawAdsItems) {
          const rawAny = adsJobs[0].get('items')
          if (typeof rawAny === 'string') rawAdsItems = rawAny
        }

        let parsedAds = []
        if (typeof rawAdsItems === 'string' && rawAdsItems.length > 0) {
          try {
            parsedAds = JSON.parse(rawAdsItems)
          } catch (eParse) {
            debugLog.push('Falha no JSON.parse de items: ' + String(eParse))
          }
        } else if (Array.isArray(rawAdsItems)) {
          parsedAds = rawAdsItems
        }

        debugLog.push(
          'Encontrado ml_ads_fetch_jobs com ' + parsedAds.length + ' anúncios sincronizados.',
        )

        for (let i = 0; i < parsedAds.length; i++) {
          const ad = parsedAds[i]
          if (!ad || !ad.id) continue

          const adCatId = String(ad.catalog_product_id || '').trim()
          const adTitle = String(ad.title || '')
          const adBrand = String(ad.brand || '')
          const adModel = String(ad.model || '')
          const adId = String(ad.id).trim()
          const adSearchableText =
            adTitle + ' ' + adBrand + ' ' + adModel + ' ' + adCatId + ' ' + adId

          if (!matchesAllTokens(adSearchableText, queryTokens)) {
            continue
          }

          const effectiveCatalogId = adCatId || adId
          if (seenCandidateCatalogIds[effectiveCatalogId]) continue
          seenCandidateCatalogIds[effectiveCatalogId] = true

          let adCond = String(ad.condition || '')
            .toLowerCase()
            .trim()
          if (adCond === 'recondicionado' || adCond === 'refurbished') {
            adCond = 'refurbished'
          } else if (adCond === 'usado' || adCond === 'used') {
            adCond = 'used'
          } else if (adCond === 'novo' || adCond === 'new') {
            adCond = 'new'
          }

          let adGrade = ad.condition_grade || ''
          const titleLowerForGrade = adTitle.toLowerCase()
          if (!adGrade) {
            if (titleLowerForGrade.includes('excelente')) adGrade = 'Excelente'
            else if (titleLowerForGrade.includes('muito bom')) adGrade = 'Muito bom'
            else if (titleLowerForGrade.includes('bom')) adGrade = 'Bom'
            else if (titleLowerForGrade.includes('aceit')) adGrade = 'Aceitável'
          }
          if (adCond === 'refurbished' && !adGrade) {
            adGrade = 'Excelente'
          }

          ownCandidates.push({
            catalog_product_id: effectiveCatalogId,
            real_catalog_product_id: adCatId || '',
            own_ad_id: ad.id,
            title: ad.title || '',
            condition: adCond,
            condition_grade: adGrade,
            price: ad.price || null,
            thumbnail: ad.thumbnail || '',
            permalink: ad.permalink || 'https://produto.mercadolivre.com.br/' + ad.id,
            available_quantity: ad.available_quantity != null ? ad.available_quantity : null,
            source: 'own_account_ads_fetch',
          })
        }
      }
    } catch (errAdsMining) {
      debugLog.push('Aviso na mineração de ml_ads_fetch_jobs: ' + String(errAdsMining))
    }

    // 0b. Minerar a coleção local `products`
    try {
      const localProducts = appId.findRecordsByFilter('products', '1=1', '-updated', 100, 0)
      if (localProducts && localProducts.length > 0) {
        for (let lp = 0; lp < localProducts.length; lp++) {
          const prodRec = localProducts[lp]
          const pName = prodRec.getString('name') || ''
          const pModel = prodRec.getString('model') || ''
          const pBrand = prodRec.getString('brand') || ''
          const pListingId = prodRec.getString('ml_listing_id') || ''
          const pCatId = prodRec.getString('catalog_product_id') || ''
          const pText = pName + ' ' + pModel + ' ' + pBrand + ' ' + pListingId + ' ' + pCatId

          if (!matchesAllTokens(pText, queryTokens)) {
            continue
          }

          const effectiveCatId = pCatId || pListingId
          if (!effectiveCatId || seenCandidateCatalogIds[effectiveCatId]) continue
          seenCandidateCatalogIds[effectiveCatId] = true

          let pCond = prodRec.getString('condition_type') || ''
          if (pCond === 'recondicionado' || pCond === 'refurbished') {
            pCond = 'refurbished'
          } else if (pCond === 'usado' || pCond === 'used') {
            pCond = 'used'
          } else if (pCond === 'novo' || pCond === 'new') {
            pCond = 'new'
          }

          let pGrade = prodRec.getString('condition_grade') || ''
          if (pCond === 'refurbished' && !pGrade) {
            pGrade = 'Excelente'
          }

          ownCandidates.push({
            catalog_product_id: effectiveCatId,
            real_catalog_product_id: pCatId || '',
            own_ad_id: pListingId || undefined,
            title: prodRec.getString('name') || '',
            condition: pCond,
            condition_grade: pGrade,
            price: prodRec.getNumber('unit_price') || null,
            source: 'own_account_local_product',
          })
        }
      }
    } catch (errProdMining) {
      debugLog.push('Aviso na mineração de local products: ' + String(errProdMining))
    }

    debugLog.push('Candidatos próprios encontrados: ' + ownCandidates.length)

    // 0c. Enriquecer posições próprias e injetar no TOPO
    if (ownCandidates.length > 0) {
      rec.set(
        'progress_text',
        'Encontrada(s) ' +
          ownCandidates.length +
          ' posição(ões) de catálogo na sua conta. Processando...',
      )
      appId.save(rec)

      for (let oc = 0; oc < ownCandidates.length; oc++) {
        const cand = ownCandidates[oc]
        const catId = cand.catalog_product_id
        const realCatId = cand.real_catalog_product_id
        if (seenCatalogIds[catId]) continue

        let isEnriched = false

        // Se tiver catalog_product_id real no catálogo ML, consulta GET /products/{realCatId}
        if (realCatId && token) {
          try {
            const enrichUrl = 'https://api.mercadolibre.com/products/' + realCatId
            const enrichRes = $http.send({
              url: enrichUrl,
              method: 'GET',
              headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
              timeout: 10,
            })

            debugLog.push(
              'Enriquecimento de posição própria ' + realCatId + ': status ' + enrichRes.statusCode,
            )

            if (enrichRes.statusCode === 200 && enrichRes.json) {
              const p = enrichRes.json
              const condInfo = extractProductCondition(p)
              const compInfo = extractCompetitionData(p)

              let thumb = ''
              if (p.pictures && p.pictures.length > 0) {
                thumb = p.pictures[0].url || p.pictures[0].secure_url
              } else if (p.thumbnail) {
                thumb = p.thumbnail
              }

              const leanAttrs = []
              if (Array.isArray(p.attributes)) {
                for (let a = 0; a < p.attributes.length; a++) {
                  const attr = p.attributes[a]
                  if (!attr || !attr.id) continue
                  const attrIdUpper = String(attr.id).toUpperCase()
                  if (
                    attrIdUpper === 'BRAND' ||
                    attrIdUpper === 'MODEL' ||
                    attrIdUpper === 'LINE' ||
                    attrIdUpper === 'GRADING' ||
                    attrIdUpper === 'ITEM_CONDITION'
                  ) {
                    leanAttrs.push({
                      id: attrIdUpper,
                      name: attr.name || attrIdUpper,
                      value_id: attr.value_id || null,
                      value_name: attr.value_name || null,
                    })
                  }
                }
              }

              const finalCond =
                condInfo.condition !== 'new'
                  ? condInfo.condition
                  : cand.condition === 'recondicionado' || cand.condition === 'refurbished'
                    ? 'refurbished'
                    : cand.condition === 'usado' || cand.condition === 'used'
                      ? 'used'
                      : condInfo.condition

              const finalGrade =
                condInfo.condition_grade ||
                cand.condition_grade ||
                (finalCond === 'refurbished' ? 'Excelente' : undefined)

              const finalCondLabel =
                finalCond === 'refurbished'
                  ? 'Recondicionado'
                  : finalCond === 'used'
                    ? 'Usado'
                    : condInfo.condition_label || 'Novo'

              seenCatalogIds[catId] = true
              seenCatalogIds[realCatId] = true
              itemsFound.push({
                id: p.id || realCatId,
                catalog_product_id: realCatId,
                title: p.name || p.title || cand.title || 'Posição ' + realCatId,
                domain_id: p.domain_id || domainId || '',
                permalink: p.permalink || 'https://www.mercadolivre.com.br/p/' + realCatId,
                thumbnail: thumb,
                buy_box_winner_price: compInfo.buy_box_winner_price || cand.price,
                min_price: compInfo.min_price || cand.price,
                buy_box_winner_seller_id: compInfo.buy_box_winner_seller_id,
                buy_box_winner_item_id: compInfo.buy_box_winner_item_id || cand.own_ad_id,
                buy_box_winner_stock: compInfo.buy_box_winner_stock,
                stock_status: compInfo.stock_status,
                competition_status: compInfo.competition_status,
                attributes: leanAttrs,
                condition: finalCond,
                condition_label: finalCondLabel,
                condition_grade: finalGrade,
                status: p.status || 'active',
                source: 'own_account_enriched',
                is_own_account: true,
                own_ad_id: cand.own_ad_id,
              })
              isEnriched = true
              strategyUsed = 'own_account_mined'
            }
          } catch (errEnrich) {
            debugLog.push(
              'Erro ao enriquecer posição própria ' + realCatId + ': ' + String(errEnrich),
            )
          }
        }

        if (!isEnriched) {
          debugLog.push('Injetando anúncio próprio como posição de catálogo: ' + cand.own_ad_id)

          let itemThumb = cand.thumbnail || ''
          let itemAttrs = []
          let itemStock = cand.available_quantity != null ? cand.available_quantity : 1
          let itemPrice = cand.price || null

          if (cand.own_ad_id && token && (!itemThumb || !itemPrice)) {
            try {
              const itRes = $http.send({
                url: 'https://api.mercadolibre.com/items/' + cand.own_ad_id,
                method: 'GET',
                headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
                timeout: 8,
              })
              if (itRes.statusCode === 200 && itRes.json) {
                const ij = itRes.json
                if (ij.pictures && ij.pictures.length > 0) {
                  itemThumb = ij.pictures[0].url || ij.pictures[0].secure_url
                } else if (ij.thumbnail) {
                  itemThumb = ij.thumbnail
                }
                if (ij.price) itemPrice = Number(ij.price)
                if (ij.available_quantity != null) itemStock = Number(ij.available_quantity)

                if (Array.isArray(ij.attributes)) {
                  for (let a = 0; a < ij.attributes.length; a++) {
                    const attr = ij.attributes[a]
                    if (!attr || !attr.id) continue
                    const attrIdUpper = String(attr.id).toUpperCase()
                    if (
                      attrIdUpper === 'BRAND' ||
                      attrIdUpper === 'MODEL' ||
                      attrIdUpper === 'LINE' ||
                      attrIdUpper === 'GRADING' ||
                      attrIdUpper === 'ITEM_CONDITION'
                    ) {
                      itemAttrs.push({
                        id: attrIdUpper,
                        name: attr.name || attrIdUpper,
                        value_id: attr.value_id || null,
                        value_name: attr.value_name || null,
                      })
                    }
                  }
                }
              }
            } catch (_) {}
          }

          const candCond = cand.condition || 'refurbished'
          const candGrade =
            cand.condition_grade || (candCond === 'refurbished' ? 'Excelente' : undefined)
          const candLabel =
            candCond === 'refurbished' ? 'Recondicionado' : candCond === 'used' ? 'Usado' : 'Novo'

          seenCatalogIds[catId] = true
          itemsFound.push({
            id: cand.own_ad_id || catId,
            catalog_product_id: cand.own_ad_id || catId,
            title: cand.title || 'Posição ' + (cand.own_ad_id || catId),
            domain_id: domainId || 'MLB-NOTEBOOKS',
            permalink:
              cand.permalink || 'https://produto.mercadolivre.com.br/' + (cand.own_ad_id || catId),
            thumbnail: itemThumb,
            buy_box_winner_price: itemPrice,
            min_price: itemPrice,
            buy_box_winner_seller_id: '626774396',
            buy_box_winner_item_id: cand.own_ad_id,
            buy_box_winner_stock: itemStock,
            stock_status: itemStock + ' un. em estoque (sua conta)',
            competition_status: 'Sua posição de venda ativa no ML',
            attributes: itemAttrs,
            condition: candCond,
            condition_label: candLabel,
            condition_grade: candGrade,
            status: 'active',
            source: 'own_account_mined_direct',
            is_own_account: true,
            own_ad_id: cand.own_ad_id,
          })
          strategyUsed = 'own_account_mined'
        }
      }
    }

    // =========================================================================
    // ETAPA 1: SE FORNECIDO catalog_product_id DIRETO NA QUERY
    // =========================================================================
    if (directCatalogId && !seenCatalogIds[directCatalogId]) {
      debugLog.push('Tentando consulta direta por ID: ' + directCatalogId)
      rec.set('progress_text', 'Consultando produto de catálogo direto: ' + directCatalogId)
      appId.save(rec)

      const url = 'https://api.mercadolibre.com/products/' + directCatalogId
      const headers = { Accept: 'application/json' }
      if (token) headers['Authorization'] = 'Bearer ' + token

      try {
        const res = $http.send({ url: url, method: 'GET', headers: headers, timeout: 12 })
        debugLog.push('/products/' + directCatalogId + ' status: ' + res.statusCode)
        if (res.statusCode === 200 && res.json) {
          const p = res.json

          let thumb = ''
          if (p.pictures && p.pictures.length > 0) {
            thumb = p.pictures[0].url || p.pictures[0].secure_url
          } else if (p.thumbnail) {
            thumb = p.thumbnail
          }

          const leanDirectAttributes = []
          if (Array.isArray(p.attributes)) {
            for (let a = 0; a < p.attributes.length; a++) {
              const attr = p.attributes[a]
              if (!attr || !attr.id) continue
              const attrIdUpper = String(attr.id).toUpperCase()
              if (
                attrIdUpper === 'BRAND' ||
                attrIdUpper === 'MODEL' ||
                attrIdUpper === 'LINE' ||
                attrIdUpper === 'GRADING' ||
                attrIdUpper === 'ITEM_CONDITION'
              ) {
                leanDirectAttributes.push({
                  id: attrIdUpper,
                  name: attr.name || attrIdUpper,
                  value_id: attr.value_id || null,
                  value_name: attr.value_name || null,
                })
              }
            }
          }

          const condInfo = extractProductCondition(p)
          const compInfo = extractCompetitionData(p)

          itemsFound.push({
            id: p.id,
            catalog_product_id: p.id,
            title: p.name || p.title || queryRaw,
            domain_id: p.domain_id || domainId,
            permalink: p.permalink || 'https://www.mercadolivre.com.br/p/' + p.id,
            thumbnail: thumb,
            buy_box_winner_price: compInfo.buy_box_winner_price,
            min_price: compInfo.min_price,
            buy_box_winner_seller_id: compInfo.buy_box_winner_seller_id,
            buy_box_winner_item_id: compInfo.buy_box_winner_item_id,
            buy_box_winner_stock: compInfo.buy_box_winner_stock,
            stock_status: compInfo.stock_status,
            competition_status: compInfo.competition_status,
            attributes: leanDirectAttributes,
            condition: condInfo.condition,
            condition_label: condInfo.condition_label,
            condition_grade: condInfo.condition_grade || undefined,
            status: p.status || 'active',
            source: 'ml_product_direct',
          })
          seenCatalogIds[p.id] = true
          strategyUsed = 'api_products_direct'
          pagingSummary.total = 1
          pagingSummary.pages_fetched = 1
          pagingSummary.items_count = itemsFound.length
          pagingSummary.sub_searches_total = 1
          pagingSummary.sub_searches_completed = 1
          pagingSummary.universe_estimated_total = 1
          pagingSummary.coverage_percentage = 100
        }
      } catch (err) {
        debugLog.push('Erro na consulta direta: ' + String(err))
      }
    }

    // =========================================================================
    // ETAPA 2: BUSCA EM LEQUE (FAN-OUT) MULTIDIMENSIONAL via /products/search
    // Multiplica a cobertura além do limite rígido de 1.000 de UMA busca da API ML.
    // =========================================================================
    if (!directCatalogId && token) {
      // 2a. Gerador de variações de query inteligentes
      // Exemplo para "dell latitude 5420":
      //   - "dell latitude 5420" (original)
      //   - "latitude 5420" (sem stop words e marca, ou marca+modelo)
      //   - "5420" (código do modelo numérico)
      const cleanTokens = tokenizeText(queryRaw)
      const queryVariations = []
      const seenQueries = {}

      function addQueryVariation(qStr) {
        const trimmed = (qStr || '').trim().replace(/\s+/g, ' ')
        if (!trimmed || trimmed.length < 2) return
        const key = trimmed.toLowerCase()
        if (seenQueries[key]) return
        seenQueries[key] = true
        queryVariations.push(trimmed)
      }

      // Query original
      addQueryVariation(queryRaw)

      // Query sem stopwords (já limpa por tokenizeText)
      if (cleanTokens.length > 0) {
        addQueryVariation(cleanTokens.join(' '))
      }

      // Se tiver marca comum conhecida no início (ex.: Dell, Lenovo, HP, Apple, Acer, Asus, Samsung)
      const knownBrands = ['dell', 'lenovo', 'hp', 'apple', 'acer', 'asus', 'samsung', 'thinkpad']
      const nonBrandTokens = cleanTokens.filter(function (t) {
        return knownBrands.indexOf(t) === -1
      })
      if (nonBrandTokens.length > 0 && nonBrandTokens.length < cleanTokens.length) {
        addQueryVariation(nonBrandTokens.join(' '))
      }

      // Sub-tokens puramente numéricos ou alfa-numéricos fortes (ex.: "5420", "t480", "e5470")
      const modelCodes = cleanTokens.filter(function (t) {
        return /^[a-z]?[0-9]{3,5}[a-z]?$/i.test(t)
      })
      for (let m = 0; m < modelCodes.length; m++) {
        addQueryVariation(modelCodes[m])
      }

      // Palavra-chave da condição selecionada
      let conditionKeyword = ''
      if (requestedCondition === 'refurbished') {
        conditionKeyword = 'recondicionado'
      } else if (requestedCondition === 'used') {
        conditionKeyword = 'usado'
      } else if (requestedCondition === 'new') {
        conditionKeyword = 'novo'
      }

      // 2b. Construção da grade de sub-buscas em leque
      // Combina variações de termos x condições (com e sem) x ordenações (padrão, price_asc, price_desc)
      const fanOutTasks = []
      const seenTaskKeys = {}

      function addTask(qTerm, withCondWord, sortParam, priorityWeight) {
        const finalTerm =
          withCondWord && conditionKeyword && !qTerm.toLowerCase().includes(conditionKeyword)
            ? qTerm + ' ' + conditionKeyword
            : qTerm
        const sortKey = sortParam || 'relevance'
        const taskKey = finalTerm.toLowerCase() + '||' + sortKey
        if (seenTaskKeys[taskKey]) return
        seenTaskKeys[taskKey] = true

        fanOutTasks.push({
          queryTerm: finalTerm,
          baseTerm: qTerm,
          hasConditionKeyword: Boolean(withCondWord && conditionKeyword),
          sort: sortParam || null,
          priority: priorityWeight || 10,
          label:
            '"' +
            finalTerm +
            '"' +
            (sortParam === 'price_asc'
              ? ' (menor preço)'
              : sortParam === 'price_desc'
                ? ' (maior preço)'
                : ''),
        })
      }

      // Se há condição específica solicitada (ex.: refurbished), a primeira prioridade é com o termo de condição
      if (conditionKeyword) {
        // Sub-buscas com palavra-chave de condição
        for (let q = 0; q < queryVariations.length; q++) {
          addTask(queryVariations[q], true, null, 1) // Relevância focada na condição
        }
        // Variação de ordenação para a query principal com condição
        addTask(queryVariations[0], true, 'price_asc', 2)
        addTask(queryVariations[0], true, 'price_desc', 3)
      }

      // Sub-buscas gerais (abertas, sem fixar condição no termo)
      for (let q = 0; q < queryVariations.length; q++) {
        addTask(queryVariations[q], false, null, conditionKeyword ? 5 : 1)
      }

      // Caudas com ordenação reversa na query sem condição
      addTask(queryVariations[0], false, 'price_asc', conditionKeyword ? 6 : 2)
      addTask(queryVariations[0], false, 'price_desc', conditionKeyword ? 7 : 3)

      if (queryVariations.length > 1) {
        addTask(queryVariations[1], false, 'price_asc', 8)
      }

      // Ordena tarefas por prioridade
      fanOutTasks.sort(function (a, b) {
        return a.priority - b.priority
      })

      pagingSummary.sub_searches_total = fanOutTasks.length

      // Limites de segurança e metas globais
      const PAGE_LIMIT = 50
      const MAX_PAGES_PER_SUBSEARCH = 20 // 20 * 50 = 1.000 por sub-busca (limite da API ML)
      const GLOBAL_MAX_ITEMS = 6000 // Teto amplo de itens únicos para varrer "infinito"
      const GLOBAL_MAX_PAGES = 150 // Teto global de páginas HTTP somadas
      let globalPagesFetched = 0
      let maxReportedApiTotal = 0

      debugLog.push(
        'Iniciando busca em leque (fan-out) com ' +
          fanOutTasks.length +
          ' sub-buscas planejadas. Cap global: ' +
          GLOBAL_MAX_ITEMS +
          ' itens únicos / ' +
          GLOBAL_MAX_PAGES +
          ' páginas totais.',
      )

      for (let taskIdx = 0; taskIdx < fanOutTasks.length; taskIdx++) {
        if (itemsFound.length >= GLOBAL_MAX_ITEMS || globalPagesFetched >= GLOBAL_MAX_PAGES) {
          debugLog.push(
            'Teto global de segurança atingido (' +
              itemsFound.length +
              ' itens, ' +
              globalPagesFetched +
              ' páginas somadas). Encerrando leque.',
          )
          pagingSummary.max_cap_reached = true
          break
        }

        const task = fanOutTasks[taskIdx]
        const subIndex = taskIdx + 1
        let offset = 0
        let subPageNum = 0
        let subTotalAnnounced = null
        let consecutiveEmptyPages = 0

        debugLog.push('-> Sub-busca ' + subIndex + '/' + fanOutTasks.length + ': ' + task.label)

        while (
          subPageNum < MAX_PAGES_PER_SUBSEARCH &&
          itemsFound.length < GLOBAL_MAX_ITEMS &&
          globalPagesFetched < GLOBAL_MAX_PAGES
        ) {
          subPageNum++
          globalPagesFetched++

          // Monta URL da sub-busca
          let searchUrl =
            'https://api.mercadolibre.com/products/search?status=active&site_id=MLB&q=' +
            encodeURIComponent(task.queryTerm) +
            '&limit=' +
            PAGE_LIMIT +
            '&offset=' +
            offset
          if (domainId) {
            searchUrl += '&domain_id=' + encodeURIComponent(domainId)
          }
          if (task.sort) {
            searchUrl += '&sort=' + encodeURIComponent(task.sort)
          }

          // Atualizar feedback de progresso em tempo real no banco
          try {
            const progressLine =
              'Varredura ' +
              subIndex +
              ' de ' +
              fanOutTasks.length +
              ': ' +
              task.label +
              ' (pág. ' +
              subPageNum +
              ')... ' +
              itemsFound.length +
              ' posições únicas acumuladas'
            rec.set('progress_text', progressLine)
            pagingSummary.pages_fetched = globalPagesFetched
            pagingSummary.items_count = itemsFound.length
            pagingSummary.sub_searches_completed = taskIdx
            rec.set('paging', pagingSummary)
            appId.save(rec)
          } catch (_) {}

          // Pequena pausa para evitar 429 (rate-limit)
          sleepMs(80)

          let res
          let retries429 = 0
          while (retries429 < 2) {
            try {
              res = $http.send({
                url: searchUrl,
                method: 'GET',
                headers: {
                  Authorization: 'Bearer ' + token,
                  Accept: 'application/json',
                },
                timeout: 15,
              })
              if (res.statusCode === 429) {
                retries429++
                debugLog.push('Rate limit (429) na sub-busca ' + subIndex + '. Pausando 1.5s...')
                sleepMs(1500)
                continue
              }
              break
            } catch (errHttp) {
              debugLog.push(
                'Erro HTTP na sub-busca ' +
                  subIndex +
                  ' pág ' +
                  subPageNum +
                  ': ' +
                  String(errHttp),
              )
              break
            }
          }

          if (!res || res.statusCode !== 200 || !res.json) {
            debugLog.push(
              'Sub-busca ' +
                subIndex +
                ' pág ' +
                subPageNum +
                ' status não-200 (' +
                (res ? res.statusCode : 'sem resposta') +
                ')',
            )
            break
          }

          const data = res.json
          const results = data.results || []
          const paging = data.paging || {}
          if (typeof paging.total === 'number') {
            subTotalAnnounced = paging.total
            if (paging.total > maxReportedApiTotal) {
              maxReportedApiTotal = paging.total
            }
          }

          if (results.length === 0) {
            consecutiveEmptyPages++
            if (consecutiveEmptyPages >= 1) break
          }

          let newInThisBatch = 0
          for (let r = 0; r < results.length; r++) {
            const prod = results[r]
            const catId = prod.id
            if (!catId || seenCatalogIds[catId]) {
              continue
            }
            seenCatalogIds[catId] = true
            newInThisBatch++

            let thumb = ''
            if (prod.pictures && prod.pictures.length > 0) {
              thumb = prod.pictures[0].url || prod.pictures[0].secure_url
            } else if (prod.thumbnail) {
              thumb = prod.thumbnail
            }

            const leanAttributes = []
            if (Array.isArray(prod.attributes)) {
              for (let a = 0; a < prod.attributes.length; a++) {
                const attr = prod.attributes[a]
                if (!attr || !attr.id) continue
                const attrIdUpper = String(attr.id).toUpperCase()
                if (
                  attrIdUpper === 'BRAND' ||
                  attrIdUpper === 'MODEL' ||
                  attrIdUpper === 'LINE' ||
                  attrIdUpper === 'GRADING' ||
                  attrIdUpper === 'ITEM_CONDITION'
                ) {
                  leanAttributes.push({
                    id: attrIdUpper,
                    name: attr.name || attrIdUpper,
                    value_id: attr.value_id || null,
                    value_name: attr.value_name || null,
                  })
                }
              }
            }

            const condInfo = extractProductCondition(prod)
            const compInfo = extractCompetitionData(prod)

            itemsFound.push({
              id: prod.id,
              catalog_product_id: prod.id,
              title: (prod.name || prod.title || '').substring(0, 140),
              domain_id: prod.domain_id || domainId || '',
              permalink: prod.permalink || 'https://www.mercadolivre.com.br/p/' + prod.id,
              thumbnail: thumb,
              buy_box_winner_price: compInfo.buy_box_winner_price,
              min_price: compInfo.min_price,
              buy_box_winner_seller_id: compInfo.buy_box_winner_seller_id,
              buy_box_winner_item_id: compInfo.buy_box_winner_item_id,
              buy_box_winner_stock: compInfo.buy_box_winner_stock,
              stock_status: compInfo.stock_status,
              competition_status: compInfo.competition_status,
              attributes: leanAttributes,
              condition: condInfo.condition,
              condition_label: condInfo.condition_label,
              condition_grade: condInfo.condition_grade || undefined,
              status: prod.status || 'active',
              source: 'ml_products_search_fanout',
            })
          }

          if (results.length < PAGE_LIMIT) {
            // Última página desta sub-busca
            break
          }

          offset += results.length
          if (subTotalAnnounced != null && offset >= subTotalAnnounced) {
            break
          }

          // Se a página não trouxe nenhum item novo por 2 vezes seguidas, avança para a próxima varredura do leque
          if (newInThisBatch === 0) {
            consecutiveEmptyPages++
            if (consecutiveEmptyPages >= 2) {
              debugLog.push(
                'Sub-busca ' +
                  subIndex +
                  ': 2 páginas seguidas sem itens inéditos. Avançando leque.',
              )
              break
            }
          } else {
            consecutiveEmptyPages = 0
          }
        }

        pagingSummary.sub_searches_completed = taskIdx + 1
      }

      if (strategyUsed === 'none' && itemsFound.length > 0) {
        strategyUsed = 'api_products_fanout'
      }

      // Métricas consolidadas honestas
      pagingSummary.total = maxReportedApiTotal || itemsFound.length
      pagingSummary.pages_fetched = globalPagesFetched
      pagingSummary.items_count = itemsFound.length
      pagingSummary.universe_estimated_total = maxReportedApiTotal || itemsFound.length
      pagingSummary.coverage_percentage =
        pagingSummary.universe_estimated_total > 0
          ? Math.min(
              100,
              Math.round((itemsFound.length / pagingSummary.universe_estimated_total) * 100),
            )
          : 100
      pagingSummary.has_uncovered_universe =
        pagingSummary.universe_estimated_total > itemsFound.length
    }

    // =========================================================================
    // ETAPA 3: ENRIQUECIMENTO DAS PRIMEIRAS POSIÇÕES SEM PREÇO
    // =========================================================================
    if (itemsFound.length > 0 && token) {
      const candidatesToEnrich = itemsFound.filter((it) => !it.buy_box_winner_price).slice(0, 5)

      if (candidatesToEnrich.length > 0) {
        debugLog.push(
          'Enriquecendo ' +
            candidatesToEnrich.length +
            ' primeiras posições sem preço via GET /products/{id}...',
        )
        for (let eIdx = 0; eIdx < candidatesToEnrich.length; eIdx++) {
          const targetItem = candidatesToEnrich[eIdx]
          try {
            const enrichRes = $http.send({
              url: 'https://api.mercadolibre.com/products/' + targetItem.catalog_product_id,
              method: 'GET',
              headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
              timeout: 6,
            })
            if (enrichRes.statusCode === 200 && enrichRes.json) {
              const pDetail = enrichRes.json
              const freshComp = extractCompetitionData(pDetail)
              if (freshComp.buy_box_winner_price) {
                targetItem.buy_box_winner_price = freshComp.buy_box_winner_price
                targetItem.min_price = freshComp.min_price
                targetItem.buy_box_winner_seller_id = freshComp.buy_box_winner_seller_id
                targetItem.buy_box_winner_item_id = freshComp.buy_box_winner_item_id
                targetItem.buy_box_winner_stock = freshComp.buy_box_winner_stock
                targetItem.stock_status = freshComp.stock_status
                targetItem.competition_status = freshComp.competition_status
              }
              const freshCond = extractProductCondition(pDetail)
              if (freshCond.condition !== 'new' || targetItem.condition === 'unknown') {
                targetItem.condition = freshCond.condition
                targetItem.condition_label = freshCond.condition_label
                if (freshCond.condition_grade) {
                  targetItem.condition_grade = freshCond.condition_grade
                }
              }
            }
          } catch (_) {}
        }
      }
    }

    // =========================================================================
    // ETAPA 4: ORDENAÇÃO E PRIORIZAÇÃO
    // 1º: Posições da própria conta (is_own_account === true) SEMPRE NO TOPO ABSOLUTO!
    // 2º: Posições que casam com a condição solicitada
    // =========================================================================
    itemsFound.sort(function (a, b) {
      const aOwn = a.is_own_account ? 1 : 0
      const bOwn = b.is_own_account ? 1 : 0
      if (aOwn !== bOwn) {
        return bOwn - aOwn
      }

      if (requestedCondition !== 'all') {
        const aMatches = a.condition === requestedCondition ? 1 : 0
        const bMatches = b.condition === requestedCondition ? 1 : 0
        if (aMatches !== bMatches) {
          return bMatches - aMatches
        }
      }

      return 0
    })

    const ownCount = itemsFound.filter(function (it) {
      return it.is_own_account
    }).length

    let finalProgressMsg = ''
    if (itemsFound.length > 0) {
      finalProgressMsg =
        itemsFound.length +
        ' posições únicas cobertas' +
        (pagingSummary.universe_estimated_total > itemsFound.length
          ? ' de ~' + pagingSummary.universe_estimated_total + ' anunciadas'
          : '') +
        (ownCount > 0 ? ' (' + ownCount + ' da sua conta no topo)' : '') +
        (pagingSummary.sub_searches_completed > 1
          ? ' em ' + pagingSummary.sub_searches_completed + ' varreduras em leque'
          : '')
    } else {
      finalProgressMsg = 'Nenhuma posição encontrada no catálogo'
    }

    debugLog.push(
      'Busca concluída: ' +
        itemsFound.length +
        ' itens (' +
        ownCount +
        ' próprios). Cobertura estimada: ' +
        pagingSummary.coverage_percentage +
        '%. Estratégia: ' +
        strategyUsed,
    )

    // Função para sanitizar e compactar itens mantendo tudo que a UI precisa
    // Nível 1: mantém BRAND, MODEL, GRADING
    // Nível 2: remove attributes totalmente
    function sanitizeForDatabase(items, level) {
      return items.map(function (item) {
        const base = {
          id: item.id,
          catalog_product_id: item.catalog_product_id,
          title: (item.title || '').substring(0, 130),
          domain_id: item.domain_id || '',
          permalink:
            item.permalink || 'https://www.mercadolivre.com.br/p/' + item.catalog_product_id,
          thumbnail: item.thumbnail || '',
          buy_box_winner_price: item.buy_box_winner_price,
          min_price: item.min_price,
          buy_box_winner_stock: item.buy_box_winner_stock,
          stock_status: item.stock_status,
          competition_status: item.competition_status,
          condition: item.condition || 'new',
          condition_label: item.condition_label || 'Novo',
          status: item.status || 'active',
          is_own_account: Boolean(item.is_own_account),
          own_ad_id: item.own_ad_id || undefined,
        }
        if (item.condition_grade) {
          base.condition_grade = item.condition_grade
        }
        if (level === 1) {
          base.attributes = (item.attributes || []).filter(function (a) {
            return (
              a.id === 'BRAND' ||
              a.id === 'MODEL' ||
              a.id === 'GRADING' ||
              a.id === 'ITEM_CONDITION'
            )
          })
        } else {
          base.attributes = []
        }
        return base
      })
    }

    // Gravação resiliente com quedas graduais de payload
    // Suporta milhares de itens salvando com segurança
    let saveSuccess = false
    let currentPayload = sanitizeForDatabase(itemsFound, 1)
    let attempt = 1

    while (!saveSuccess && attempt <= 6) {
      try {
        rec.set('status', 'done')
        rec.set('status_code', 200)
        rec.set('strategy_used', strategyUsed)
        rec.set('results', currentPayload)
        rec.set('progress_text', finalProgressMsg)
        pagingSummary.items_count = currentPayload.length
        rec.set('paging', pagingSummary)
        const trimmedDebug = debugLog.length > 50 ? debugLog.slice(-50) : debugLog
        rec.set('raw_debug', trimmedDebug)
        appId.save(rec)
        saveSuccess = true
      } catch (errSave) {
        attempt++
        console.warn(
          '[ml_catalog_search] Falha na gravação do resultado (tentativa ' +
            (attempt - 1) +
            '): ' +
            String(errSave),
        )
        debugLog.push(
          'Falha no save dos resultados (tentativa ' + (attempt - 1) + '): ' + String(errSave),
        )

        // Degradação progressiva:
        // Tentativa 2: Remove atributos secundários (attributes=[]) mantendo todos os itens
        // Tentativa 3: Se ainda muito pesado, mantém até 2.500 itens sem atributos
        // Tentativa 4: Mantém até 1.500 itens
        // Tentativa 5: Mantém até 800 itens
        // Tentativa 6: Mantém até 300 itens
        if (attempt === 2) {
          currentPayload = sanitizeForDatabase(itemsFound, 2)
        } else if (attempt === 3) {
          currentPayload = sanitizeForDatabase(itemsFound.slice(0, 2500), 2)
        } else if (attempt === 4) {
          currentPayload = sanitizeForDatabase(itemsFound.slice(0, 1500), 2)
        } else if (attempt === 5) {
          currentPayload = sanitizeForDatabase(itemsFound.slice(0, 800), 2)
        } else if (attempt === 6) {
          currentPayload = sanitizeForDatabase(itemsFound.slice(0, 300), 2)
        }
      }
    }

    if (!saveSuccess) {
      rec.set('status', 'error')
      rec.set('status_code', 500)
      rec.set('error_message', 'Excedido limite de tamanho ao persistir resultados no banco.')
      rec.set('progress_text', 'Falha ao salvar os ' + itemsFound.length + ' anúncios coletados.')
      rec.set('results', [])
      rec.set('raw_debug', debugLog.slice(-30))
      appId.save(rec)
    }
  } catch (errGlobal) {
    debugLog.push('Erro fatal: ' + String(errGlobal))
    try {
      rec.set('status', 'error')
      rec.set('status_code', 500)
      rec.set('error_message', String(errGlobal))
      rec.set('progress_text', 'Erro durante a busca profunda no catálogo')
      rec.set('raw_debug', debugLog.slice(-30))
      appId.save(rec)
    } catch (_) {}
  }
}, 'ml_catalog_search_jobs')
