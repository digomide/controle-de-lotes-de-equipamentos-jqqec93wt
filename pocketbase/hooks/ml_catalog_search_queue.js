/// <reference path="../pb_data/types.d.ts" />

/**
 * Hook de fila para busca profunda no catálogo do Mercado Livre
 * Executa de forma assíncrona ao criar um registro em ml_catalog_search_jobs.
 * Implementa:
 * 1. Mineração antecipada da conta do vendedor (ml_ads_fetch_jobs e coleção products):
 *    - Anúncios próprios que já possuem catalog_product_id.
 *    - Casamento flexível por tokens de busca e condição solicitada (refurbished / used).
 *    - Enriquecimento completo via GET /products/{id} (fotos, Buy Box, GRADING).
 *    - Injeção das posições próprias no TOPO com `is_own_account: true` e `own_ad_id`.
 * 2. Early Stop com busca aberta:
 *    - Quando condition === 'refurbished' || condition === 'used', limita a varredura aberta a 2–3 páginas.
 * 3. Extração resiliente de Condição / GRADING / Classificação.
 * 4. Gravação resiliente com quedas graduais de payload para NUNCA estourar limite do banco de dados.
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
          if (valId === '2230284' || valLower === 'novo' || valLower === 'new') {
            // Nota: não retorna imediatamente se tiver GRADING ou refurbished_info
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
  const pagingSummary = {
    total: 0,
    pages_fetched: 0,
    items_count: 0,
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
      recondicionado: 1,
      usado: 1,
      novo: 1,
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
    // no TOPO, contornando o teto de paginação de 1.000 itens da /products/search da API ML.
    const queryTokens = tokenizeText(queryRaw)
    const ownCandidates = []
    const seenCandidateCatalogIds = {}

    debugLog.push(
      'Etapa 0: Minerando anúncios próprios para tokens: [' + queryTokens.join(', ') + ']',
    )

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
          if (!ad || !ad.catalog_product_id) continue

          const catId = String(ad.catalog_product_id).trim()
          if (!catId || seenCandidateCatalogIds[catId]) continue

          const adTitle = String(ad.title || '').toLowerCase()
          const adBrand = String(ad.brand || '').toLowerCase()
          const adModel = String(ad.model || '').toLowerCase()
          const adText = adTitle + ' ' + adBrand + ' ' + adModel + ' ' + catId.toLowerCase()

          // Casamento de tokens
          let matchesTokens = true
          if (queryTokens.length > 0) {
            for (let t = 0; t < queryTokens.length; t++) {
              if (adText.indexOf(queryTokens[t]) === -1) {
                matchesTokens = false
                break
              }
            }
          }

          if (matchesTokens) {
            seenCandidateCatalogIds[catId] = true
            ownCandidates.push({
              catalog_product_id: catId,
              own_ad_id: ad.id,
              title: ad.title || '',
              condition: ad.condition || '',
              condition_grade: ad.condition_grade || '',
              price: ad.price || null,
              source: 'own_account_ads_fetch',
            })
          }
        }
      }
    } catch (errAdsMining) {
      debugLog.push('Aviso na mineração de ml_ads_fetch_jobs: ' + String(errAdsMining))
    }

    // 0b. Minerar a coleção local `products`
    try {
      const localProducts = appId.findRecordsByFilter(
        'products',
        "catalog_product_id != ''",
        '-updated',
        50,
        0,
      )
      if (localProducts && localProducts.length > 0) {
        for (let lp = 0; lp < localProducts.length; lp++) {
          const prodRec = localProducts[lp]
          const catId = prodRec.getString('catalog_product_id')
          if (!catId || seenCandidateCatalogIds[catId]) continue

          const pName = (prodRec.getString('name') || '').toLowerCase()
          const pModel = (prodRec.getString('model') || '').toLowerCase()
          const pBrand = (prodRec.getString('brand') || '').toLowerCase()
          const pText = pName + ' ' + pModel + ' ' + pBrand

          let matchesTokens = true
          if (queryTokens.length > 0) {
            for (let t = 0; t < queryTokens.length; t++) {
              if (pText.indexOf(queryTokens[t]) === -1) {
                matchesTokens = false
                break
              }
            }
          }

          if (matchesTokens) {
            seenCandidateCatalogIds[catId] = true
            ownCandidates.push({
              catalog_product_id: catId,
              own_ad_id: prodRec.getString('ml_listing_id') || undefined,
              title: prodRec.getString('name') || '',
              condition: prodRec.getString('condition_type') || '',
              condition_grade: prodRec.getString('condition_grade') || '',
              price: prodRec.getNumber('unit_price') || null,
              source: 'own_account_local_product',
            })
          }
        }
      }
    } catch (errProdMining) {
      debugLog.push('Aviso na mineração de local products: ' + String(errProdMining))
    }

    debugLog.push('Candidatos próprios encontrados: ' + ownCandidates.length)

    // 0c. Enriquecer posições próprias via GET /products/{id} e injetar no TOPO
    if (ownCandidates.length > 0 && token) {
      rec.set(
        'progress_text',
        'Encontrada(s) ' +
          ownCandidates.length +
          ' posição(ões) de catálogo na sua conta. Enriquecendo via Mercado Livre...',
      )
      appId.save(rec)

      for (let oc = 0; oc < ownCandidates.length; oc++) {
        const cand = ownCandidates[oc]
        const catId = cand.catalog_product_id
        if (seenCatalogIds[catId]) continue

        try {
          const enrichUrl = 'https://api.mercadolibre.com/products/' + catId
          const enrichRes = $http.send({
            url: enrichUrl,
            method: 'GET',
            headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
            timeout: 10,
          })

          debugLog.push(
            'Enriquecimento de posição própria ' + catId + ': status ' + enrichRes.statusCode,
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

            // Usar condição detectada da API ou da conta do vendedor
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
            itemsFound.push({
              id: p.id || catId,
              catalog_product_id: catId,
              title: p.name || p.title || cand.title || 'Posição ' + catId,
              domain_id: p.domain_id || domainId || '',
              permalink: p.permalink || 'https://www.mercadolivre.com.br/p/' + catId,
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
            strategyUsed = 'own_account_mined'
          }
        } catch (errEnrich) {
          debugLog.push('Erro ao enriquecer posição própria ' + catId + ': ' + String(errEnrich))
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
          pagingSummary.items_count = 1
        }
      } catch (err) {
        debugLog.push('Erro na consulta direta: ' + String(err))
      }
    }

    // =========================================================================
    // ETAPA 2: BUSCA ABERTA PAGINADA via /products/search com token
    // Com EARLY STOP para condition='refurbished' ou 'used'
    // =========================================================================
    if (!directCatalogId && token) {
      const baseEndpoints = []

      let conditionKeyword = ''
      if (requestedCondition === 'refurbished') {
        conditionKeyword = 'recondicionado'
      } else if (requestedCondition === 'used') {
        conditionKeyword = 'usado'
      } else if (requestedCondition === 'new') {
        conditionKeyword = 'novo'
      }

      const queryHasCondWord = conditionKeyword && queryRaw.toLowerCase().includes(conditionKeyword)

      // Se o usuário selecionou uma condição específica (ex: Recondicionado / Usado / Novo),
      // a primeira estratégia é focada com o termo da condição:
      if (conditionKeyword && !queryHasCondWord) {
        const targetedQuery = queryRaw + ' ' + conditionKeyword
        if (domainId) {
          baseEndpoints.push({
            name: 'domain_and_query_condition_focused',
            buildUrl: (offset, limit) =>
              'https://api.mercadolibre.com/products/search?status=active&site_id=MLB&domain_id=' +
              encodeURIComponent(domainId) +
              '&q=' +
              encodeURIComponent(targetedQuery) +
              '&limit=' +
              limit +
              '&offset=' +
              offset,
          })
        }

        baseEndpoints.push({
          name: 'query_only_active_condition_focused',
          buildUrl: (offset, limit) =>
            'https://api.mercadolibre.com/products/search?status=active&site_id=MLB&q=' +
            encodeURIComponent(targetedQuery) +
            '&limit=' +
            limit +
            '&offset=' +
            offset,
        })
      }

      // Se tiver domain_id explícito definido pelo usuário
      if (domainId) {
        baseEndpoints.push({
          name: 'domain_and_query',
          buildUrl: (offset, limit) =>
            'https://api.mercadolibre.com/products/search?status=active&site_id=MLB&domain_id=' +
            encodeURIComponent(domainId) +
            '&q=' +
            encodeURIComponent(queryRaw) +
            '&limit=' +
            limit +
            '&offset=' +
            offset,
        })
      }

      // Busca ativa geral sem fixar domínio
      baseEndpoints.push({
        name: 'query_only_active',
        buildUrl: (offset, limit) =>
          'https://api.mercadolibre.com/products/search?status=active&site_id=MLB&q=' +
          encodeURIComponent(queryRaw) +
          '&limit=' +
          limit +
          '&offset=' +
          offset,
      })

      // Busca ampla
      baseEndpoints.push({
        name: 'query_only_broad',
        buildUrl: (offset, limit) =>
          'https://api.mercadolibre.com/products/search?site_id=MLB&q=' +
          encodeURIComponent(queryRaw) +
          '&limit=' +
          limit +
          '&offset=' +
          offset,
      })

      const PAGE_LIMIT = 50
      // EARLY STOP: quando o usuário procura Recondicionado ou Usado,
      // varrer no máximo 2–3 páginas abertas para não demorar nem afogar as fontes próprias
      const isNarrowCondition =
        requestedCondition === 'refurbished' || requestedCondition === 'used'
      const MAX_PAGES = isNarrowCondition ? 3 : 20
      const MAX_TOTAL_CAP = isNarrowCondition ? 150 : 1000

      debugLog.push(
        'Iniciando busca aberta paginada. Limite de páginas: ' +
          MAX_PAGES +
          ' (cap: ' +
          MAX_TOTAL_CAP +
          ')',
      )

      for (let i = 0; i < baseEndpoints.length; i++) {
        const ep = baseEndpoints[i]
        debugLog.push('Tentando busca profunda com estratégia: ' + ep.name)

        let offset = 0
        let pageNum = 0
        let totalAnnounced = null
        let endpointMatched = false

        while (pageNum < MAX_PAGES && itemsFound.length < MAX_TOTAL_CAP) {
          pageNum++
          const url = ep.buildUrl(offset, PAGE_LIMIT)
          debugLog.push('Buscando página ' + pageNum + ' (offset ' + offset + '): ' + url)

          // Atualizar feedback de progresso no registro
          try {
            const pageProgressText =
              totalAnnounced != null
                ? 'Buscando página ' +
                  pageNum +
                  ' de ' +
                  Math.max(1, Math.ceil(Math.min(totalAnnounced, MAX_TOTAL_CAP) / PAGE_LIMIT)) +
                  ' (' +
                  itemsFound.length +
                  ' anúncios carregados)...'
                : 'Buscando página ' +
                  pageNum +
                  (itemsFound.length > 0 ? ' (' + itemsFound.length + ' anúncios)...' : '...')
            rec.set('progress_text', pageProgressText)
            appId.save(rec)
          } catch (_) {}

          let res
          try {
            res = $http.send({
              url: url,
              method: 'GET',
              headers: {
                Authorization: 'Bearer ' + token,
                Accept: 'application/json',
              },
              timeout: 15,
            })
          } catch (errHttp) {
            debugLog.push('Erro HTTP na pág ' + pageNum + ': ' + String(errHttp))
            break
          }

          debugLog.push('Status: ' + res.statusCode)
          if (res.statusCode !== 200 || !res.json) {
            debugLog.push('Resposta não-200 ou vazia: ' + String(res.raw || '').substring(0, 150))
            break
          }

          const data = res.json
          const results = data.results || []
          const paging = data.paging || {}
          if (typeof paging.total === 'number') {
            totalAnnounced = paging.total
            pagingSummary.total = paging.total
          }

          debugLog.push(
            'Página ' +
              pageNum +
              ': ' +
              results.length +
              ' itens retornados (total da busca: ' +
              (totalAnnounced != null ? totalAnnounced : 'desconhecido') +
              ')',
          )

          if (results.length === 0) {
            debugLog.push('Nenhum resultado retornado nesta página. Encerrando iteração.')
            break
          }

          endpointMatched = true
          let newInThisPage = 0

          for (let r = 0; r < results.length; r++) {
            const prod = results[r]
            const catId = prod.id
            if (!catId || seenCatalogIds[catId]) {
              continue
            }
            seenCatalogIds[catId] = true
            newInThisPage++

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
              title: (prod.name || prod.title || '').substring(0, 150),
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
              source: 'ml_products_search',
            })
          }

          pagingSummary.pages_fetched = pageNum
          pagingSummary.items_count = itemsFound.length

          debugLog.push(
            'Novos itens nesta página: ' +
              newInThisPage +
              ' | Total acumulado: ' +
              itemsFound.length,
          )

          if (results.length < PAGE_LIMIT) {
            debugLog.push('Página retornou ' + results.length + ' < limit. Fim dos resultados.')
            break
          }

          offset += results.length
          if (totalAnnounced != null && offset >= totalAnnounced) {
            debugLog.push(
              'Offset ' + offset + ' atingiu total ' + totalAnnounced + '. Busca completa.',
            )
            break
          }

          if (newInThisPage === 0) {
            debugLog.push('Nenhum item novo nesta página. Encerrando paginação.')
            break
          }
        }

        if (endpointMatched && itemsFound.length > 0) {
          if (strategyUsed === 'none') {
            strategyUsed = 'api_products_search'
          }
          // Com narrow condition e itens achados, para logo após a primeira estratégia bem-sucedida
          if (isNarrowCondition) {
            debugLog.push('Early stop aplicado para condição focada (' + requestedCondition + ')')
            break
          }
          break
        }
      }
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
    // 1º: Posições da própria conta (is_own_account === true) SEMPRE NO TOPO!
    // 2º: Posições que casam com a condição solicitada
    // =========================================================================
    itemsFound.sort(function (a, b) {
      // Posição própria da conta fica no topo absoluto
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
        ' posições encontradas' +
        (ownCount > 0 ? ' (' + ownCount + ' da sua conta)' : '') +
        (pagingSummary.pages_fetched > 0
          ? ' em ' +
            pagingSummary.pages_fetched +
            (pagingSummary.pages_fetched === 1 ? ' página' : ' páginas')
          : '')
    } else {
      finalProgressMsg = 'Nenhuma posição encontrada no catálogo'
    }

    debugLog.push(
      'Busca concluída: ' +
        itemsFound.length +
        ' itens (' +
        ownCount +
        ' próprios). Estratégia: ' +
        strategyUsed,
    )

    // Função para sanitizar e compactar itens mantendo tudo que a UI precisa
    function sanitizeForDatabase(items, level) {
      return items.map(function (item) {
        const base = {
          id: item.id,
          catalog_product_id: item.catalog_product_id,
          title: (item.title || '').substring(0, 140),
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
          // Mantém BRAND, MODEL, GRADING apenas se existirem
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
    let saveSuccess = false
    let currentPayload = sanitizeForDatabase(itemsFound, 1)
    let attempt = 1

    while (!saveSuccess && attempt <= 5) {
      try {
        rec.set('status', 'done')
        rec.set('status_code', 200)
        rec.set('strategy_used', strategyUsed)
        rec.set('results', currentPayload)
        rec.set('progress_text', finalProgressMsg)
        rec.set('paging', pagingSummary)
        const trimmedDebug = debugLog.length > 40 ? debugLog.slice(-40) : debugLog
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

        if (attempt === 2) {
          currentPayload = sanitizeForDatabase(itemsFound, 2)
        } else if (attempt === 3) {
          currentPayload = sanitizeForDatabase(itemsFound.slice(0, 300), 2)
          pagingSummary.items_count = currentPayload.length
        } else if (attempt === 4) {
          currentPayload = sanitizeForDatabase(itemsFound.slice(0, 150), 2)
          pagingSummary.items_count = currentPayload.length
        } else if (attempt === 5) {
          currentPayload = sanitizeForDatabase(itemsFound.slice(0, 60), 2)
          pagingSummary.items_count = currentPayload.length
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
