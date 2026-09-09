/**
 * Worker unificado de segundo plano para processamento assíncrono do Mercado Livre.
 *
 * Executa a cada 10 segundos:
 * 1. Processa ml_oauth_requests pendentes
 * 2. Processa ml_publish_queue pendentes
 * 3. Processa ml_item_queue pendentes
 * 4. ETAPA 1 CRÍTICA: Processa 1 job pendente de ml_catalog_search_jobs por tick,
 *    executando a varredura profunda com streaming de resultados parciais,
 *    enriquecimento e filtro de categoria oficial do ML (ETAPA 2).
 *
 * IMPORTANTE: No PocketBase (Goja JSVM), callbacks do cron executam isolados.
 * Todas as funções auxiliares DEVEM estar inline dentro do corpo do cronAdd!
 */

cronAdd('ml_queue_worker', '*/1 * * * *', () => {
  let settings = null
  try {
    const records = $app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (records && records.length > 0) {
      settings = records[0]
    }
  } catch (err) {
    console.log('[ml_cron] Erro ao carregar ml_settings: ' + err)
  }

  // 1. Processar ml_oauth_requests pendentes
  try {
    const pendingOAuth = $app.findRecordsByFilter(
      'ml_oauth_requests',
      "status = 'pending'",
      'created',
      5,
      0,
    )

    for (let i = 0; i < pendingOAuth.length; i++) {
      const req = pendingOAuth[i]
      const code = req.getString('code')
      const customRedirectUri = req.getString('redirect_uri')

      if (!settings) {
        req.set('status', 'error')
        req.set('error_message', 'Configurações do Mercado Livre não encontradas no sistema.')
        $app.save(req)
        continue
      }

      const clientId = settings.getString('client_id')
      const clientSecret = settings.getString('client_secret')
      const redirectUri = customRedirectUri || settings.getString('redirect_uri')

      if (!clientId || !clientSecret) {
        req.set('status', 'error')
        req.set('error_message', 'Client ID ou Client Secret do Mercado Livre não configurados.')
        $app.save(req)
        continue
      }

      let tokenRes = null
      try {
        tokenRes = $http.send({
          url: 'https://api.mercadolibre.com/oauth/token',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            grant_type: 'authorization_code',
            client_id: clientId,
            client_secret: clientSecret,
            code: code,
            redirect_uri: redirectUri,
          }),
          timeout: 30,
        })
      } catch (netErr) {
        req.set('status', 'error')
        req.set(
          'error_message',
          'Falha de rede ao conectar ao Mercado Livre: ' + (netErr.message || netErr),
        )
        $app.save(req)
        continue
      }

      if (tokenRes.statusCode >= 400) {
        const errJson = tokenRes.json || {}
        const errorDesc =
          errJson.error_description ||
          errJson.message ||
          errJson.error ||
          'Falha na autenticação OAuth do Mercado Livre (status ' + tokenRes.statusCode + ').'
        req.set('status', 'error')
        req.set('error_message', errorDesc)
        $app.save(req)
        continue
      }

      const tokenData = tokenRes.json || {}
      const accessToken = tokenData.access_token || ''
      const refreshToken = tokenData.refresh_token || ''
      const expiresIn = Number(tokenData.expires_in) || 21600
      const userId = (tokenData.user_id || '').toString()

      if (!accessToken) {
        req.set('status', 'error')
        req.set('error_message', 'Mercado Livre não retornou access_token válido.')
        $app.save(req)
        continue
      }

      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

      let nickname = ''
      let permalink = ''
      try {
        const userRes = $http.send({
          url: 'https://api.mercadolibre.com/users/me',
          method: 'GET',
          headers: {
            Authorization: 'Bearer ' + accessToken,
          },
          timeout: 15,
        })
        if (userRes.statusCode === 200 && userRes.json) {
          nickname = userRes.json.nickname || ''
          permalink = userRes.json.permalink || ''
        }
      } catch (uErr) {
        console.log('[ml_cron] Erro ao buscar perfil ML: ' + uErr)
      }

      settings.set('access_token', accessToken)
      settings.set('refresh_token', refreshToken)
      settings.set('token_expires_at', expiresAt)
      settings.set('user_id_ml', userId)
      settings.set('nickname', nickname)
      settings.set('permalink_seller', permalink)
      if (redirectUri && !settings.getString('redirect_uri')) {
        settings.set('redirect_uri', redirectUri)
      }
      $app.save(settings)

      req.set('status', 'done')
      req.set('error_message', '')
      $app.save(req)
      console.log('[ml_cron] OAuth concluído para: ' + nickname)
    }
  } catch (oauthErr) {
    console.log('[ml_cron] Erro em ml_oauth_requests: ' + oauthErr)
  }

  // 2. Processar ml_item_queue pendentes
  try {
    const pendingItems = $app.findRecordsByFilter(
      'ml_item_queue',
      "status = 'pending'",
      'created',
      5,
      0,
    )

    for (let i = 0; i < pendingItems.length; i++) {
      const itemAction = pendingItems[i]
      itemAction.set('status', 'done')
      $app.save(itemAction)
    }
  } catch (itemErr) {
    console.log('[ml_cron] Erro em ml_item_queue: ' + itemErr)
  }

  // =========================================================================
  // 3. ETAPA 1 CRÍTICA: PROCESSAMENTO DE ml_catalog_search_jobs EM SEGUNDO PLANO
  // Pega até 1 job pending por tick
  // =========================================================================
  try {
    const pendingSearchJobs = $app.findRecordsByFilter(
      'ml_catalog_search_jobs',
      "status = 'pending'",
      'created',
      1,
      0,
    )

    if (pendingSearchJobs && pendingSearchJobs.length > 0) {
      const rec = pendingSearchJobs[0]
      const appId = $app
      const jobId = rec.id

      rec.set('status', 'processing')
      rec.set('progress_text', 'Iniciando varredura profunda no Mercado Livre...')
      appId.save(rec)

      const queryRaw = (rec.getString('query') || '').trim()
      const rawDomain = (rec.getString('domain_id') || '').trim()
      const domainId = rawDomain === 'all' || !rawDomain ? '' : rawDomain
      const selectedCategoryId = (rec.getString('category_id') || '').trim()

      const requestedConditionRaw = (rec.getString('condition') || '').trim().toLowerCase()
      const requestedCondition =
        requestedConditionRaw === 'refurbished' ||
        requestedConditionRaw === 'new' ||
        requestedConditionRaw === 'used' ||
        requestedConditionRaw === 'open_box'
          ? requestedConditionRaw
          : 'all'

      // Token de acesso do ML
      let token = ''
      try {
        if (settings) {
          token = settings.getString('access_token')
        } else {
          const sRecs = appId.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
          if (sRecs && sRecs.length > 0) token = sRecs[0].getString('access_token')
        }
      } catch (_) {}

      // Helper de parada pelo usuário
      const isStopRequested = function () {
        try {
          const fresh = appId.findRecordById('ml_catalog_search_jobs', jobId)
          if (fresh) {
            return Boolean(
              fresh.getBool ? fresh.getBool('stop_requested') : fresh.get('stop_requested'),
            )
          }
        } catch (_) {}
        return false
      }

      // Helper de pausa rápida
      const sleepMs = function (ms) {
        try {
          const target = Date.now() + ms
          while (Date.now() < target) {}
        } catch (_) {}
      }

      // Tokenizador
      const tokenizeText = function (text) {
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

      // Extração de condição
      const extractProductCondition = function (prod) {
        if (!prod) return { condition: 'new', condition_label: 'Novo' }
        let gradeFound = ''

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
              if (valName) gradeFound = valName
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

        if (gradeFound) {
          return {
            condition: 'refurbished',
            condition_label: 'Recondicionado',
            condition_grade: gradeFound,
          }
        }

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

        const titleLower = String(prod.name || prod.title || '').toLowerCase()
        if (titleLower.includes('recondicionado') || titleLower.includes('refurbished')) {
          let inferredGrade = ''
          if (titleLower.includes('excelente')) inferredGrade = 'Excelente'
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

        return { condition: 'new', condition_label: 'Novo' }
      }

      // Sold quantity helper
      const extractSoldQuantity = function (obj) {
        if (!obj) return null
        if (obj.sold_quantity != null && !isNaN(Number(obj.sold_quantity))) {
          return Number(obj.sold_quantity)
        }
        if (
          obj.sold_quantity_mercadopago != null &&
          !isNaN(Number(obj.sold_quantity_mercadopago))
        ) {
          return Number(obj.sold_quantity_mercadopago)
        }
        if (Array.isArray(obj.attributes)) {
          for (let a = 0; a < obj.attributes.length; a++) {
            const attr = obj.attributes[a]
            if (!attr || !attr.id) continue
            const attrIdUpper = String(attr.id).toUpperCase()
            if (
              attrIdUpper === 'SOLD_QUANTITY' ||
              attrIdUpper === 'TOTAL_SOLD' ||
              attrIdUpper === 'ITEMS_SOLD'
            ) {
              const valNum = Number(attr.value_name || attr.value_id)
              if (!isNaN(valNum)) return valNum
            }
          }
        }
        return null
      }

      // Extração de dados da concorrência
      const extractCompetitionData = function (prod) {
        let bbPrice = null
        let minPrice = null
        let winnerSellerId = null
        let winnerSellerNickname = ''
        let winnerItemId = null
        let winnerStock = null
        let winnerListingType = ''
        let winnerListingTypeLabel = ''
        let winnerFreeShipping = null
        let winnerShippingMode = ''
        let stockStatus = 'Estoque não público'
        let competitionStatus = 'Sem concorrente ativo'
        let soldQuantity = extractSoldQuantity(prod)

        if (prod && prod.buy_box_winner) {
          const bb = prod.buy_box_winner
          if (bb.price && bb.price > 0) {
            bbPrice = Number(bb.price)
            minPrice = bbPrice
          }
          if (bb.seller_id) winnerSellerId = String(bb.seller_id)
          if (bb.item_id) winnerItemId = String(bb.item_id)
          if (bb.available_quantity != null && bb.available_quantity > 0) {
            winnerStock = Number(bb.available_quantity)
            stockStatus = winnerStock + ' un. em estoque'
          } else if (bb.price) {
            stockStatus = 'Pronta entrega (1+ un.)'
          }
          if (bb.listing_type_id) {
            winnerListingType = bb.listing_type_id
            winnerListingTypeLabel =
              bb.listing_type_id === 'gold_pro'
                ? 'Premium'
                : bb.listing_type_id === 'gold_special'
                  ? 'Clássico'
                  : bb.listing_type_id
          }
          if (bb.shipping) {
            winnerFreeShipping = Boolean(bb.shipping.free_shipping)
            winnerShippingMode = bb.shipping.mode || ''
          }
          if (soldQuantity == null) soldQuantity = extractSoldQuantity(bb)
          competitionStatus = 'Disputa ativa na Buy Box'
        } else if (prod && prod.price && prod.price > 0) {
          bbPrice = Number(prod.price)
          minPrice = bbPrice
          competitionStatus = 'Preço de referência do catálogo'
          stockStatus = 'Estoque sob consulta'
        }

        return {
          buy_box_winner_price: bbPrice,
          min_price: minPrice,
          buy_box_winner_seller_id: winnerSellerId,
          buy_box_winner_seller_nickname: winnerSellerNickname,
          buy_box_winner_item_id: winnerItemId,
          buy_box_winner_stock: winnerStock,
          buy_box_winner_listing_type: winnerListingType,
          buy_box_winner_listing_type_label: winnerListingTypeLabel,
          buy_box_winner_free_shipping: winnerFreeShipping,
          buy_box_winner_shipping_mode: winnerShippingMode,
          suggested_price_to_win: null,
          competition_raw_status: '',
          competitors_count: 0,
          competitors: [],
          stock_status: stockStatus,
          competition_status: competitionStatus,
          sold_quantity: soldQuantity != null ? Number(soldQuantity) : null,
        }
      }

      // Sanitização resiliente para SQLite
      const sanitizeForDatabase = function (items) {
        return items.map(function (item) {
          let brandVal = item.brand_value || ''
          let modelVal = item.model_value || ''
          if (Array.isArray(item.attributes)) {
            for (let aIdx = 0; aIdx < item.attributes.length; aIdx++) {
              const at = item.attributes[aIdx]
              if (!at || !at.id) continue
              const atIdUpper = String(at.id).toUpperCase()
              if (!brandVal && (atIdUpper === 'BRAND' || atIdUpper === 'MARCA')) {
                brandVal = String(at.value_name || at.value_id || '').trim()
              }
              if (
                !modelVal &&
                (atIdUpper === 'MODEL' || atIdUpper === 'MODELO' || atIdUpper === 'LINE')
              ) {
                modelVal = String(at.value_name || at.value_id || '').trim()
              }
            }
          }

          const base = {
            id: item.id,
            catalog_product_id: item.catalog_product_id,
            title: (item.title || '').substring(0, 110),
            domain_id: item.domain_id || '',
            category_id: item.category_id || selectedCategoryId || '',
            category_path: item.category_path || '',
            family_name: item.family_name || '',
            subfamily_name: item.subfamily_name || '',
            permalink:
              item.permalink || 'https://www.mercadolivre.com.br/p/' + item.catalog_product_id,
            thumbnail: item.thumbnail || '',
            buy_box_winner_price:
              item.buy_box_winner_price != null ? Number(item.buy_box_winner_price) : null,
            min_price: item.min_price != null ? Number(item.min_price) : null,
            buy_box_winner_seller_nickname: (item.buy_box_winner_seller_nickname || '').substring(
              0,
              40,
            ),
            buy_box_winner_item_id: item.buy_box_winner_item_id
              ? String(item.buy_box_winner_item_id)
              : '',
            buy_box_winner_listing_type_label: item.buy_box_winner_listing_type_label || '',
            buy_box_winner_stock:
              item.buy_box_winner_stock != null ? Number(item.buy_box_winner_stock) : null,
            suggested_price_to_win:
              item.suggested_price_to_win != null ? Number(item.suggested_price_to_win) : null,
            competitors_count: item.competitors_count != null ? Number(item.competitors_count) : 0,
            competitors: Array.isArray(item.competitors) ? item.competitors : [],
            stock_status: item.stock_status || '',
            competition_status: item.competition_status || '',
            condition: item.condition || 'new',
            condition_label: item.condition_label || 'Novo',
            status: item.status || 'active',
            is_own_account: Boolean(item.is_own_account),
            own_ad_id: item.own_ad_id || undefined,
            sold_quantity:
              item.sold_quantity != null && !isNaN(Number(item.sold_quantity))
                ? Number(item.sold_quantity)
                : null,
          }
          if (brandVal) base.brand_value = brandVal
          if (modelVal) base.model_value = modelVal
          if (item.condition_grade) base.condition_grade = item.condition_grade
          return base
        })
      }

      const debugLog = []
      const itemsFound = []
      const seenCatalogIds = {}
      let strategyUsed = 'worker_background'

      const pagingSummary = {
        total: 0,
        pages_fetched: 0,
        items_count: 0,
        sub_searches_total: 0,
        sub_searches_completed: 0,
        universe_estimated_total: 0,
        coverage_percentage: 0,
      }

      // Salvamento parcial a cada 2.5s para streaming progressivo da busca
      let lastPartialSaveTime = 0
      const saveProgressiveResults = function (force) {
        const now = Date.now()
        if (!force && now - lastPartialSaveTime < 2500) return
        lastPartialSaveTime = now
        try {
          const freshRec = appId.findRecordById('ml_catalog_search_jobs', jobId)
          if (freshRec) {
            pagingSummary.items_count = itemsFound.length
            freshRec.set('paging', pagingSummary)
            freshRec.set('progress_count', itemsFound.length)
            freshRec.set('progress_text', rec.getString('progress_text'))
            const partial = sanitizeForDatabase(itemsFound.slice(0, 1000))
            freshRec.set('results', partial)
            appId.save(freshRec)
          }
        } catch (_) {}
      }

      try {
        // 1. Mineração de anúncios próprios
        const queryTokens = tokenizeText(queryRaw)
        try {
          const adsJobs = appId.findRecordsByFilter(
            'ml_ads_fetch_jobs',
            "status = 'done' && items_count > 0",
            '-created',
            1,
            0,
          )
          if (adsJobs && adsJobs.length > 0) {
            let rawAdsItems = adsJobs[0].getString('items') || adsJobs[0].get('items')
            let parsedAds = []
            if (typeof rawAdsItems === 'string' && rawAdsItems.length > 0) {
              try {
                parsedAds = JSON.parse(rawAdsItems)
              } catch (_) {}
            } else if (Array.isArray(rawAdsItems)) {
              parsedAds = rawAdsItems
            }

            for (let i = 0; i < parsedAds.length; i++) {
              const ad = parsedAds[i]
              if (!ad || !ad.id) continue
              const adTitle = String(ad.title || '').toLowerCase()
              let matches = true
              for (let t = 0; t < queryTokens.length; t++) {
                if (!adTitle.includes(queryTokens[t])) {
                  matches = false
                  break
                }
              }
              if (!matches) continue

              const effectiveId = ad.catalog_product_id || ad.id
              if (seenCatalogIds[effectiveId]) continue
              seenCatalogIds[effectiveId] = true

              itemsFound.push({
                id: ad.id,
                catalog_product_id: effectiveId,
                title: ad.title || '',
                domain_id: domainId || '',
                permalink: ad.permalink || 'https://produto.mercadolivre.com.br/' + ad.id,
                thumbnail: ad.thumbnail || '',
                buy_box_winner_price: ad.price || null,
                min_price: ad.price || null,
                buy_box_winner_seller_id: '626774396',
                buy_box_winner_seller_nickname: 'Sua Loja',
                buy_box_winner_item_id: ad.id,
                buy_box_winner_stock: ad.available_quantity != null ? ad.available_quantity : 1,
                buy_box_winner_listing_type_label: '',
                stock_status: (ad.available_quantity || 1) + ' un. em estoque (sua conta)',
                competition_status: 'Sua posição de venda ativa no ML',
                condition: ad.condition || 'refurbished',
                condition_label: ad.condition === 'new' ? 'Novo' : 'Recondicionado',
                status: 'active',
                is_own_account: true,
                own_ad_id: ad.id,
                sold_quantity: ad.sold_quantity != null ? Number(ad.sold_quantity) : null,
              })
            }
          }
        } catch (eAds) {
          debugLog.push('Aviso anúncios próprios: ' + String(eAds))
        }

        if (itemsFound.length > 0) {
          rec.set(
            'progress_text',
            'Coletando... (' + itemsFound.length + ' anúncios locais no topo)',
          )
          saveProgressiveResults(true)
        }

        // 2. Busca em leque na API de produtos do Mercado Livre com category_id se fornecido
        const PAGE_LIMIT = 50
        const MAX_PAGES = 10
        let offset = 0
        let pageNum = 0
        let totalAnnounced = null

        rec.set('progress_text', 'Coletando anúncios no catálogo do Mercado Livre...')
        appId.save(rec)

        while (pageNum < MAX_PAGES && itemsFound.length < 1500) {
          if (isStopRequested()) {
            debugLog.push('Parada solicitada pelo usuário.')
            break
          }

          pageNum++
          let searchUrl =
            'https://api.mercadolibre.com/products/search?status=active&site_id=MLB&q=' +
            encodeURIComponent(queryRaw) +
            '&limit=' +
            PAGE_LIMIT +
            '&offset=' +
            offset

          if (selectedCategoryId) {
            searchUrl += '&category=' + encodeURIComponent(selectedCategoryId)
          }
          if (domainId) {
            searchUrl += '&domain_id=' + encodeURIComponent(domainId)
          }

          rec.set(
            'progress_text',
            'Coletando... (' + itemsFound.length + ' anúncios até agora, pág. ' + pageNum + ')',
          )
          saveProgressiveResults(false)
          sleepMs(20)

          let res = null
          try {
            const headers = { Accept: 'application/json' }
            if (token) headers['Authorization'] = 'Bearer ' + token
            res = $http.send({
              url: searchUrl,
              method: 'GET',
              headers: headers,
              timeout: 10,
            })
          } catch (httpErr) {
            debugLog.push('Erro HTTP pág ' + pageNum + ': ' + String(httpErr))
            break
          }

          if (!res || res.statusCode !== 200 || !res.json) {
            break
          }

          const data = res.json
          const results = data.results || []
          const paging = data.paging || {}
          if (typeof paging.total === 'number') totalAnnounced = paging.total

          if (results.length === 0) break

          for (let r = 0; r < results.length; r++) {
            const prod = results[r]
            const catId = prod.id
            if (!catId || seenCatalogIds[catId]) continue
            seenCatalogIds[catId] = true

            let thumb = ''
            if (prod.pictures && prod.pictures.length > 0) {
              thumb = prod.pictures[0].url || prod.pictures[0].secure_url
            } else if (prod.thumbnail) {
              thumb = prod.thumbnail
            }

            const condInfo = extractProductCondition(prod)
            const compInfo = extractCompetitionData(prod)

            itemsFound.push({
              id: prod.id,
              catalog_product_id: prod.id,
              title: (prod.name || prod.title || '').substring(0, 140),
              domain_id: prod.domain_id || domainId || '',
              category_id: selectedCategoryId || '',
              permalink: prod.permalink || 'https://www.mercadolivre.com.br/p/' + prod.id,
              thumbnail: thumb,
              buy_box_winner_price: compInfo.buy_box_winner_price,
              min_price: compInfo.min_price,
              buy_box_winner_seller_id: compInfo.buy_box_winner_seller_id,
              buy_box_winner_seller_nickname: compInfo.buy_box_winner_seller_nickname || '',
              buy_box_winner_item_id: compInfo.buy_box_winner_item_id,
              buy_box_winner_stock: compInfo.buy_box_winner_stock,
              buy_box_winner_listing_type: compInfo.buy_box_winner_listing_type || '',
              buy_box_winner_listing_type_label: compInfo.buy_box_winner_listing_type_label || '',
              buy_box_winner_free_shipping: compInfo.buy_box_winner_free_shipping,
              buy_box_winner_shipping_mode: compInfo.buy_box_winner_shipping_mode || '',
              suggested_price_to_win: null,
              competitors_count: 0,
              competitors: [],
              stock_status: compInfo.stock_status,
              competition_status: compInfo.competition_status,
              condition: condInfo.condition,
              condition_label: condInfo.condition_label,
              condition_grade: condInfo.condition_grade || undefined,
              status: prod.status || 'active',
              source: 'ml_products_search_worker',
              sold_quantity: compInfo.sold_quantity != null ? compInfo.sold_quantity : null,
            })
          }

          if (results.length < PAGE_LIMIT) break
          offset += results.length
          if (totalAnnounced != null && offset >= totalAnnounced) break
        }

        // Ordenação: próprias no topo
        itemsFound.sort(function (a, b) {
          const aOwn = a.is_own_account ? 1 : 0
          const bOwn = b.is_own_account ? 1 : 0
          return bOwn - aOwn
        })

        // =========================================================================
        // ENRIQUECIMENTO DE CONCORRÊNCIA E VENDAS (TOP 20 PRODUTOS)
        // Para os top 20 produtos, consulta /products/{id}/items para obter
        // os concorrentes reais disputando a Buy Box e suas vendas (sold_quantity).
        // =========================================================================
        const ENRICH_LIMIT = Math.min(itemsFound.length, 20)
        if (ENRICH_LIMIT > 0) {
          rec.set(
            'progress_text',
            'Enriquecendo concorrência e vendas dos ' + ENRICH_LIMIT + ' principais produtos...',
          )
          appId.save(rec)

          let ownSellerId = ''
          try {
            if (settings) {
              ownSellerId = settings.getString('user_id_ml') || ''
            }
          } catch (_) {}

          const sellerNickCache = {}
          const getSellerNickname = function (sId) {
            if (!sId) return ''
            const sIdStr = String(sId).trim()
            if (!sIdStr) return ''
            if (sellerNickCache[sIdStr]) return sellerNickCache[sIdStr]
            if (ownSellerId && sIdStr === String(ownSellerId).trim()) {
              sellerNickCache[sIdStr] = 'INFOPRECOBAIXO'
              return 'INFOPRECOBAIXO'
            }
            try {
              const uRes = $http.send({
                url: 'https://api.mercadolibre.com/users/' + sIdStr,
                method: 'GET',
                headers: { Accept: 'application/json' },
                timeout: 3,
              })
              if (uRes.statusCode === 200 && uRes.json && uRes.json.nickname) {
                const nick = String(uRes.json.nickname).trim()
                sellerNickCache[sIdStr] = nick
                return nick
              }
            } catch (_) {}
            return ''
          }

          for (let eIdx = 0; eIdx < ENRICH_LIMIT; eIdx++) {
            if (isStopRequested()) break

            const itemToEnrich = itemsFound[eIdx]
            const catId = itemToEnrich.catalog_product_id || itemToEnrich.id
            if (!catId) continue

            try {
              const headers = { Accept: 'application/json' }
              if (token) headers['Authorization'] = 'Bearer ' + token

              const itemsUrl =
                'https://api.mercadolibre.com/products/' + encodeURIComponent(catId) + '/items'
              const itRes = $http.send({
                url: itemsUrl,
                method: 'GET',
                headers: headers,
                timeout: 5,
              })

              if (itRes.statusCode === 200 && itRes.json) {
                const rawList = Array.isArray(itRes.json)
                  ? itRes.json
                  : Array.isArray(itRes.json.results)
                    ? itRes.json.results
                    : []

                const enrichedCompetitors = []
                let maxSoldFromItems = null

                for (let k = 0; k < rawList.length; k++) {
                  const it = rawList[k]
                  if (!it) continue
                  const itPrice = Number(it.price || it.original_price || 0)
                  const sId = it.seller_id || (it.seller && it.seller.id) || null
                  const sNick = (it.seller && it.seller.nickname) || ''
                  const sIdStr = sId ? String(sId).trim() : ''
                  const isOwn = Boolean(ownSellerId && sIdStr === String(ownSellerId).trim())
                  const itSold = extractSoldQuantity(it)

                  if (itSold != null && (maxSoldFromItems == null || itSold > maxSoldFromItems)) {
                    maxSoldFromItems = itSold
                  }

                  enrichedCompetitors.push({
                    item_id: it.id || '',
                    seller_id: sIdStr,
                    seller_nickname: sNick,
                    price: itPrice,
                    available_quantity:
                      it.available_quantity != null ? Number(it.available_quantity) : null,
                    sold_quantity: itSold != null ? Number(itSold) : null,
                    listing_type_id: it.listing_type_id || '',
                    listing_type_label:
                      it.listing_type_id === 'gold_pro' || it.listing_type_id === 'premium'
                        ? 'Premium'
                        : 'Clássico',
                    is_buy_box_winner: Boolean(it.is_buy_box_winner || it.winner || false),
                    is_own: isOwn,
                  })
                }

                // Resolver nicknames dos primeiros 5 concorrentes sem nick
                for (let c = 0; c < enrichedCompetitors.length && c < 5; c++) {
                  const comp = enrichedCompetitors[c]
                  if (comp && comp.seller_id && !comp.seller_nickname) {
                    comp.seller_nickname = getSellerNickname(comp.seller_id)
                  }
                }

                enrichedCompetitors.sort(function (a, b) {
                  if (a.is_buy_box_winner && !b.is_buy_box_winner) return -1
                  if (!a.is_buy_box_winner && b.is_buy_box_winner) return 1
                  return (a.price || 999999) - (b.price || 999999)
                })

                itemToEnrich.competitors = enrichedCompetitors
                itemToEnrich.competitors_count = enrichedCompetitors.length

                if (enrichedCompetitors.length > 0) {
                  itemToEnrich.competition_status = 'Disputa ativa na Buy Box'
                  const winner =
                    enrichedCompetitors.find(function (c) {
                      return c.is_buy_box_winner
                    }) || enrichedCompetitors[0]

                  if (winner) {
                    if (
                      winner.price &&
                      (!itemToEnrich.buy_box_winner_price ||
                        itemToEnrich.buy_box_winner_price === 0)
                    ) {
                      itemToEnrich.buy_box_winner_price = winner.price
                      itemToEnrich.min_price = winner.price
                    }
                    if (winner.seller_nickname && !itemToEnrich.buy_box_winner_seller_nickname) {
                      itemToEnrich.buy_box_winner_seller_nickname = winner.seller_nickname
                    }
                    if (winner.seller_id && !itemToEnrich.buy_box_winner_seller_id) {
                      itemToEnrich.buy_box_winner_seller_id = winner.seller_id
                    }
                    if (winner.item_id && !itemToEnrich.buy_box_winner_item_id) {
                      itemToEnrich.buy_box_winner_item_id = winner.item_id
                    }
                    if (
                      winner.available_quantity != null &&
                      itemToEnrich.buy_box_winner_stock == null
                    ) {
                      itemToEnrich.buy_box_winner_stock = winner.available_quantity
                    }
                  }
                }

                if (
                  maxSoldFromItems != null &&
                  (itemToEnrich.sold_quantity == null ||
                    maxSoldFromItems > itemToEnrich.sold_quantity)
                ) {
                  itemToEnrich.sold_quantity = maxSoldFromItems
                }
              }
            } catch (errEnrich) {
              // Se falhar para um item, continua os demais sem quebrar o job
              debugLog.push('Erro enriquecendo ' + catId + ': ' + String(errEnrich))
            }

            sleepMs(30)
          }

          // Salvar streaming com dados enriquecidos
          saveProgressiveResults(true)
        }

        const finalPayload = sanitizeForDatabase(itemsFound)
        rec.set('status', 'done')
        rec.set('status_code', 200)
        rec.set('strategy_used', strategyUsed)
        rec.set('results', finalPayload)
        rec.set('progress_count', itemsFound.length)
        rec.set(
          'progress_text',
          itemsFound.length > 0
            ? itemsFound.length + ' posições cobertas com sucesso pelo Mercado Livre.'
            : 'Nenhum anúncio encontrado para o termo pesquisado.',
        )
        rec.set('is_cached', false)
        rec.set('cached_at', new Date().toISOString())
        pagingSummary.total = totalAnnounced || itemsFound.length
        pagingSummary.items_count = itemsFound.length
        pagingSummary.pages_fetched = pageNum
        rec.set('paging', pagingSummary)
        appId.save(rec)
        console.log(
          '[ml_cron] Job de busca concluído: ' + jobId + ' (' + itemsFound.length + ' itens)',
        )
      } catch (errGlobal) {
        console.log('[ml_cron] Erro fatal no processamento do job ' + jobId + ': ' + errGlobal)
        try {
          rec.set('status', 'error')
          rec.set('status_code', 500)
          rec.set('error_message', String(errGlobal))
          rec.set(
            'progress_text',
            'Essa busca demorou mais que o esperado ou falhou no Mercado Livre.',
          )
          appId.save(rec)
        } catch (_) {}
      }
    }
  } catch (searchJobErr) {
    console.log('[ml_cron] Erro ao buscar jobs de catálogo pendentes: ' + searchJobErr)
  }
})
