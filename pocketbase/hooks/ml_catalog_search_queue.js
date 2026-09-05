/// <reference path="../pb_data/types.d.ts" />

/**
 * Hook de fila para busca profunda no catálogo do Mercado Livre
 * Executa de forma assíncrona ao criar um registro em ml_catalog_search_jobs.
 * Implementa:
 * 1. Busca profunda com paginação (limit + offset) e deduplicação por catalog_product_id.
 * 2. Extração inteligente de Condição / Classificação do produto no catálogo do ML:
 *    - Atributos ITEM_CONDITION / CONDITION (value_id / value_name).
 *    - Buy Box Winner condition ("new", "refurbished", "used").
 *    - Heurística por texto do título / tags / domain_id / modelo.
 *    - Padrão do catálogo ML no Brasil para notebooks eletrônicos de marcas oficiais: Novo (novo de fábrica).
 * 3. Informações completas de disputa e concorrência na Buy Box:
 *    - Preço atual da Buy Box (buy_box_winner_price).
 *    - Vencedor atual da Buy Box (vendedor / item).
 *    - Menor preço concorrente ativo (min_price).
 *    - Status de estoque concorrente (buy_box_winner_stock / stock_status: "1+ un.", "Disponível", "Estoque não público").
 *    - Enriquecimento leve das primeiras posições com /products/{id} caso falte preço na busca.
 * 4. Gravação resiliente com quedas graduais de payload para NUNCA estourar limite do banco de dados
 *    e NUNCA deixar o job preso em status 'processing'.
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

    // (1) Atributo ITEM_CONDITION ou CONDITION no array attributes
    if (Array.isArray(prod.attributes)) {
      for (let a = 0; a < prod.attributes.length; a++) {
        const attr = prod.attributes[a]
        if (!attr || !attr.id) continue
        const attrIdUpper = String(attr.id).toUpperCase()
        if (
          attrIdUpper === 'ITEM_CONDITION' ||
          attrIdUpper === 'CONDITION' ||
          attrIdUpper === 'PRODUCT_CONDITION'
        ) {
          const valName = String(attr.value_name || '')
            .toLowerCase()
            .trim()
          const valId = String(attr.value_id || '').trim()

          if (valId === '2230284' || valName === 'novo' || valName === 'new') {
            return { condition: 'new', condition_label: 'Novo' }
          }
          if (
            valId === '2230581' ||
            valName === 'recondicionado' ||
            valName === 'refurbished' ||
            valName.indexOf('recondicionado') >= 0
          ) {
            return { condition: 'refurbished', condition_label: 'Recondicionado' }
          }
          if (
            valId === '2230582' ||
            valName === 'usado' ||
            valName === 'used' ||
            valName === 'segunda mão'
          ) {
            return { condition: 'used', condition_label: 'Usado' }
          }
        }
      }
    }

    // (2) buy_box_winner.condition se presente
    if (prod.buy_box_winner && prod.buy_box_winner.condition) {
      const bbCond = String(prod.buy_box_winner.condition).toLowerCase().trim()
      if (bbCond === 'new' || bbCond === 'novo') {
        return { condition: 'new', condition_label: 'Novo' }
      }
      if (bbCond === 'refurbished' || bbCond === 'recondicionado') {
        return { condition: 'refurbished', condition_label: 'Recondicionado' }
      }
      if (bbCond === 'used' || bbCond === 'usado') {
        return { condition: 'used', condition_label: 'Usado' }
      }
    }

    // (3) Campo raiz condition (se retornado pela API)
    if (prod.condition) {
      const rootCond = String(prod.condition).toLowerCase().trim()
      if (rootCond === 'new' || rootCond === 'novo') {
        return { condition: 'new', condition_label: 'Novo' }
      }
      if (rootCond === 'refurbished' || rootCond === 'recondicionado') {
        return { condition: 'refurbished', condition_label: 'Recondicionado' }
      }
      if (rootCond === 'used' || rootCond === 'usado') {
        return { condition: 'used', condition_label: 'Usado' }
      }
    }

    // (4) Heurística por texto no nome/título ou tags
    const titleLower = String(prod.name || prod.title || '').toLowerCase()
    if (titleLower.indexOf('recondicionado') >= 0 || titleLower.indexOf('refurbished') >= 0) {
      return { condition: 'refurbished', condition_label: 'Recondicionado' }
    }
    if (titleLower.indexOf('usado') >= 0 || titleLower.indexOf('seminovo') >= 0) {
      return { condition: 'used', condition_label: 'Usado' }
    }

    // (5) No ecossistema oficial do Mercado Livre (MLB), todas as posições canônicas criadas pelo catálogo
    // de marcas oficiais (Dell, Lenovo, HP, etc.) que não especificam recondicionado são catalogadas como "Novo".
    // Isso é consistente com as regras de Buy Box do ML.
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

  try {
    // 1. Se fornecido catalog_product_id direto:
    if (directCatalogId) {
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
              if (attrIdUpper === 'BRAND' || attrIdUpper === 'MODEL' || attrIdUpper === 'LINE') {
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

    // 2. BUSCA PROFUNDA PAGINADA via /products/search com token
    if (itemsFound.length === 0 && token) {
      const baseEndpoints = []

      // Se tiver domain_id explícito definido pelo usuário, tenta primeiro com ele
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

      // Busca ativa geral sem fixar domínio (permite achar iphone, notebook, monitor, etc.)
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

      // Busca ampla sem filtro de status caso o active não traga nada
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
      const MAX_TOTAL_CAP = 1000
      const MAX_PAGES = 25

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

          // Atualizar feedback de progresso no registro para o usuário acompanhar em tempo real
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

            // Normalizar atributos: manter apenas os essenciais de forma enxuta
            const leanAttributes = []
            if (Array.isArray(prod.attributes)) {
              for (let a = 0; a < prod.attributes.length; a++) {
                const attr = prod.attributes[a]
                if (!attr || !attr.id) continue
                const attrIdUpper = String(attr.id).toUpperCase()
                if (attrIdUpper === 'BRAND' || attrIdUpper === 'MODEL' || attrIdUpper === 'LINE') {
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
          strategyUsed = 'api_products_search'
          break
        }
      }
    }

    // 3. Enriquecimento leve das primeiras posições que não têm buy_box_winner_price na busca
    // Consulta no máximo 5 posições individuais via GET /products/{id} para preencher preço/vencedor se disponível
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
              }
            }
          } catch (errEnrich) {
            // Ignora silenciosamente para não interromper fluxo
          }
        }
      }
    }

    // 4. Cascata se a busca de produtos não retornou nada:
    // Scraping da busca pública do Mercado Livre para extrair os /p/MLB...
    if (itemsFound.length === 0 && queryRaw) {
      try {
        debugLog.push(
          'Tentando cascata scraping público profundo para extrair produtos de catálogo /p/MLB...',
        )
        rec.set(
          'progress_text',
          'Buscando posições de catálogo via catálogo público do Mercado Livre...',
        )
        appId.save(rec)

        const normalizedSlug = encodeURIComponent(queryRaw.replace(/\s+/g, '-'))
        const maxScrapePages = 3

        for (let sp = 1; sp <= maxScrapePages; sp++) {
          const searchUrl =
            sp === 1
              ? 'https://lista.mercadolivre.com.br/' + normalizedSlug
              : 'https://lista.mercadolivre.com.br/' +
                normalizedSlug +
                '_Desde_' +
                ((sp - 1) * 50 + 1)

          debugLog.push('Scraping pág ' + sp + ': ' + searchUrl)
          let pageRes
          try {
            pageRes = $http.send({
              url: searchUrl,
              method: 'GET',
              headers: {
                'User-Agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'pt-BR,pt;q=0.9',
              },
              timeout: 15,
            })
          } catch (errScrapeHttp) {
            debugLog.push('Erro HTTP scraping pág ' + sp + ': ' + String(errScrapeHttp))
            break
          }

          if (pageRes.statusCode !== 200 || !pageRes.raw) {
            break
          }

          const html = pageRes.raw
          const pRegex =
            /href=["'](https?:\/\/[^"']*mercadolivre\.com\.br\/p\/(MLB[0-9]+)[^"']*)["']/gi
          const pageDiscoveredIds = {}
          let match
          while ((match = pRegex.exec(html)) !== null) {
            const pUrl = match[1]
            const pId = match[2]
            if (!seenCatalogIds[pId] && !pageDiscoveredIds[pId]) {
              pageDiscoveredIds[pId] = pUrl
            }
          }

          const newCatIds = Object.keys(pageDiscoveredIds)
          debugLog.push(
            'Scraping pág ' + sp + ' encontrou ' + newCatIds.length + ' novos produtos de catálogo',
          )
          if (newCatIds.length === 0) {
            break
          }

          for (let k = 0; k < newCatIds.length; k++) {
            const catId = newCatIds[k]
            seenCatalogIds[catId] = true

            const prodUrl = 'https://api.mercadolibre.com/products/' + catId
            const h = { Accept: 'application/json' }
            if (token) h['Authorization'] = 'Bearer ' + token

            let added = false
            try {
              const pRes = $http.send({ url: prodUrl, method: 'GET', headers: h, timeout: 8 })
              if (pRes.statusCode === 200 && pRes.json) {
                const p = pRes.json
                const leanScrapeAttrs = []
                if (Array.isArray(p.attributes)) {
                  for (let a = 0; a < p.attributes.length; a++) {
                    const attr = p.attributes[a]
                    if (!attr || !attr.id) continue
                    const attrIdUpper = String(attr.id).toUpperCase()
                    if (
                      attrIdUpper === 'BRAND' ||
                      attrIdUpper === 'MODEL' ||
                      attrIdUpper === 'LINE'
                    ) {
                      leanScrapeAttrs.push({
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
                  title: p.name || p.title || catId,
                  domain_id: p.domain_id || domainId,
                  permalink: pageDiscoveredIds[catId],
                  thumbnail:
                    p.pictures && p.pictures.length > 0
                      ? p.pictures[0].url || p.pictures[0].secure_url
                      : p.thumbnail || '',
                  buy_box_winner_price: compInfo.buy_box_winner_price,
                  min_price: compInfo.min_price,
                  buy_box_winner_seller_id: compInfo.buy_box_winner_seller_id,
                  buy_box_winner_item_id: compInfo.buy_box_winner_item_id,
                  buy_box_winner_stock: compInfo.buy_box_winner_stock,
                  stock_status: compInfo.stock_status,
                  competition_status: compInfo.competition_status,
                  attributes: leanScrapeAttrs,
                  condition: condInfo.condition,
                  condition_label: condInfo.condition_label,
                  status: p.status || 'active',
                  source: 'ml_catalog_scrape_and_enrich',
                })
                added = true
              }
            } catch (_) {}

            if (!added) {
              itemsFound.push({
                id: catId,
                catalog_product_id: catId,
                title: 'Produto de Catálogo ' + catId,
                domain_id: domainId,
                permalink: pageDiscoveredIds[catId],
                thumbnail: '',
                buy_box_winner_price: null,
                min_price: null,
                buy_box_winner_seller_id: null,
                buy_box_winner_item_id: null,
                buy_box_winner_stock: null,
                stock_status: 'Estoque não público',
                competition_status: 'Sem concorrente ativo',
                attributes: [],
                condition: 'new',
                condition_label: 'Novo',
                status: 'active',
                source: 'ml_catalog_scrape_link',
              })
            }
          }

          pagingSummary.pages_fetched = sp
          pagingSummary.items_count = itemsFound.length
        }

        if (itemsFound.length > 0) {
          strategyUsed = 'html_scrape_catalog_links'
          pagingSummary.total = itemsFound.length
        }
      } catch (err) {
        debugLog.push('Erro scraping: ' + String(err))
      }
    }

    const finalProgressMsg =
      itemsFound.length > 0
        ? itemsFound.length +
          ' posições encontradas em ' +
          pagingSummary.pages_fetched +
          (pagingSummary.pages_fetched === 1 ? ' página' : ' páginas') +
          (pagingSummary.total > itemsFound.length
            ? ' (total anunciado: ' + pagingSummary.total + ')'
            : '')
        : 'Nenhuma posição encontrada no catálogo'

    debugLog.push(
      'Busca concluída: ' +
        itemsFound.length +
        ' itens em ' +
        pagingSummary.pages_fetched +
        ' páginas. Estratégia: ' +
        strategyUsed,
    )

    // Função para sanitizar e compactar itens mantendo tudo que a UI precisa
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
        }
        if (level === 1) {
          // Mantém BRAND e MODEL apenas se existirem
          base.attributes = (item.attributes || []).filter(function (a) {
            return a.id === 'BRAND' || a.id === 'MODEL'
          })
        } else {
          base.attributes = []
        }
        return base
      })
    }

    // Gravação resiliente com quedas graduais de payload para NUNCA estourar limite do banco de dados
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
          // Fallback 1: retirar attributes dos 1000 itens
          currentPayload = sanitizeForDatabase(itemsFound, 2)
        } else if (attempt === 3) {
          // Fallback 2: limitar a 600 itens sanitizados
          currentPayload = sanitizeForDatabase(itemsFound.slice(0, 600), 2)
          pagingSummary.items_count = currentPayload.length
        } else if (attempt === 4) {
          // Fallback 3: limitar a 350 itens
          currentPayload = sanitizeForDatabase(itemsFound.slice(0, 350), 2)
          pagingSummary.items_count = currentPayload.length
        } else if (attempt === 5) {
          // Fallback 4: limitar a 150 itens ultra-enxutos
          currentPayload = sanitizeForDatabase(itemsFound.slice(0, 150), 2)
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
