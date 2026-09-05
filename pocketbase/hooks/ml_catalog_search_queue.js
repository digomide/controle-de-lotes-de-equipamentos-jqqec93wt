/// <reference path="../pb_data/types.d.ts" />

/**
 * Hook de fila para busca no catálogo do Mercado Livre
 * Executa de forma assíncrona ao criar um registro em ml_catalog_search_jobs.
 * Testa múltiplos endpoints da API do ML com token INFOPRECOBAIXO e cascata de scraping se necessário.
 * NOTA: Toda a lógica fica inline dentro do callback para evitar problemas de escopo do JSVM.
 */

onRecordAfterCreateSuccess((e) => {
  const rec = e.record
  const appId = $app

  rec.set('status', 'processing')
  appId.save(rec)

  const queryRaw = (rec.getString('query') || '').trim()
  const domainId = (rec.getString('domain_id') || 'MLB-NOTEBOOKS').trim()

  // Função interna para obter token ML
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

  const debugLog = []
  const itemsFound = []
  let strategyUsed = 'none'

  try {
    // 1. Se fornecido catalog_product_id direto:
    if (directCatalogId) {
      debugLog.push('Tentando consulta direta por ID: ' + directCatalogId)
      const url = 'https://api.mercadolibre.com/products/' + directCatalogId
      const headers = { Accept: 'application/json' }
      if (token) headers['Authorization'] = 'Bearer ' + token

      try {
        const res = $http.send({ url: url, method: 'GET', headers: headers, timeout: 12 })
        debugLog.push('/products/' + directCatalogId + ' status: ' + res.statusCode)
        if (res.statusCode === 200 && res.json) {
          const p = res.json
          let bestPrice = null
          if (p.buy_box_winner && p.buy_box_winner.price) {
            bestPrice = p.buy_box_winner.price
          }
          let thumb = ''
          if (p.pictures && p.pictures.length > 0) {
            thumb = p.pictures[0].url || p.pictures[0].secure_url
          } else if (p.thumbnail) {
            thumb = p.thumbnail
          }

          itemsFound.push({
            id: p.id,
            catalog_product_id: p.id,
            title: p.name || p.title || queryRaw,
            domain_id: p.domain_id || domainId,
            permalink: p.permalink || 'https://www.mercadolivre.com.br/p/' + p.id,
            thumbnail: thumb,
            buy_box_winner_price: bestPrice,
            min_price: bestPrice,
            attributes: p.attributes || [],
            status: p.status || 'active',
            source: 'ml_product_direct',
          })
          strategyUsed = 'api_products_direct'
        }
      } catch (err) {
        debugLog.push('Erro na consulta direta: ' + String(err))
      }
    }

    // 2. Se ainda não achou, tentar /products/search com token
    if (itemsFound.length === 0 && token) {
      const endpointsToTry = [
        'https://api.mercadolibre.com/products/search?status=active&site_id=MLB&domain_id=' +
          encodeURIComponent(domainId) +
          '&q=' +
          encodeURIComponent(queryRaw),
        'https://api.mercadolibre.com/products/search?status=active&site_id=MLB&q=' +
          encodeURIComponent(queryRaw),
        'https://api.mercadolibre.com/products/search?site_id=MLB&q=' +
          encodeURIComponent(queryRaw),
      ]

      for (let i = 0; i < endpointsToTry.length; i++) {
        const url = endpointsToTry[i]
        try {
          debugLog.push('Tentando: ' + url)
          const res = $http.send({
            url: url,
            method: 'GET',
            headers: {
              Authorization: 'Bearer ' + token,
              Accept: 'application/json',
            },
            timeout: 12,
          })
          debugLog.push('Status: ' + res.statusCode)
          if (res.statusCode === 200 && res.json) {
            const data = res.json
            const results = data.results || []
            debugLog.push('Results length: ' + results.length)
            if (results.length > 0) {
              results.forEach((prod) => {
                let thumb = ''
                if (prod.pictures && prod.pictures.length > 0) {
                  thumb = prod.pictures[0].url || prod.pictures[0].secure_url
                } else if (prod.thumbnail) {
                  thumb = prod.thumbnail
                }
                const bestPrice = prod.buy_box_winner
                  ? prod.buy_box_winner.price
                  : prod.price || null

                itemsFound.push({
                  id: prod.id,
                  catalog_product_id: prod.id,
                  title: prod.name || prod.title || '',
                  domain_id: prod.domain_id || domainId,
                  permalink: prod.permalink || 'https://www.mercadolivre.com.br/p/' + prod.id,
                  thumbnail: thumb,
                  buy_box_winner_price: bestPrice,
                  min_price: bestPrice,
                  attributes: prod.attributes || [],
                  status: prod.status || 'active',
                  source: 'ml_products_search',
                })
              })
              strategyUsed = 'api_products_search'
              break
            }
          } else {
            debugLog.push('Body: ' + String(res.raw || '').substring(0, 150))
          }
        } catch (err) {
          debugLog.push('Erro endpoint ' + i + ': ' + String(err))
        }
      }
    }

    // 3. Cascata se a busca de produtos não retornou nada ou estiver restrita:
    // Scraping da busca pública do Mercado Livre para extrair os /p/MLB... (produtos de catálogo)
    if (itemsFound.length === 0 && queryRaw) {
      try {
        debugLog.push(
          'Tentando cascata scraping público para extrair produtos de catálogo /p/MLB...',
        )
        const searchUrl =
          'https://lista.mercadolivre.com.br/' + encodeURIComponent(queryRaw.replace(/\s+/g, '-'))
        const pageRes = $http.send({
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
        debugLog.push('Scraping status: ' + pageRes.statusCode)

        if (pageRes.statusCode === 200 && pageRes.raw) {
          const html = pageRes.raw
          const pRegex =
            /href=["'](https?:\/\/[^"']*mercadolivre\.com\.br\/p\/(MLB[0-9]+)[^"']*)["']/gi
          const seenIds = {}
          let match
          while ((match = pRegex.exec(html)) !== null) {
            const pUrl = match[1]
            const pId = match[2]
            if (!seenIds[pId]) {
              seenIds[pId] = pUrl
            }
            if (Object.keys(seenIds).length >= 10) break
          }

          const foundIds = Object.keys(seenIds)
          debugLog.push('Scraping encontrou ' + foundIds.length + ' produtos de catálogo')

          for (let k = 0; k < foundIds.length; k++) {
            const catId = foundIds[k]
            const prodUrl = 'https://api.mercadolibre.com/products/' + catId
            const h = { Accept: 'application/json' }
            if (token) h['Authorization'] = 'Bearer ' + token

            let added = false
            try {
              const pRes = $http.send({ url: prodUrl, method: 'GET', headers: h, timeout: 8 })
              if (pRes.statusCode === 200 && pRes.json) {
                const p = pRes.json
                itemsFound.push({
                  id: p.id,
                  catalog_product_id: p.id,
                  title: p.name || p.title || catId,
                  domain_id: p.domain_id || domainId,
                  permalink: seenIds[catId],
                  thumbnail:
                    p.pictures && p.pictures.length > 0
                      ? p.pictures[0].url || p.pictures[0].secure_url
                      : p.thumbnail || '',
                  buy_box_winner_price: p.buy_box_winner ? p.buy_box_winner.price : null,
                  min_price: p.buy_box_winner ? p.buy_box_winner.price : null,
                  attributes: p.attributes || [],
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
                permalink: seenIds[catId],
                thumbnail: '',
                buy_box_winner_price: null,
                min_price: null,
                attributes: [],
                status: 'active',
                source: 'ml_catalog_scrape_link',
              })
            }
          }

          if (itemsFound.length > 0) {
            strategyUsed = 'html_scrape_catalog_links'
          }
        }
      } catch (err) {
        debugLog.push('Erro scraping: ' + String(err))
      }
    }

    rec.set('status', 'done')
    rec.set('status_code', 200)
    rec.set('strategy_used', strategyUsed)
    rec.set('results', itemsFound)
    rec.set('raw_debug', debugLog)
    appId.save(rec)
  } catch (errGlobal) {
    debugLog.push('Erro fatal: ' + String(errGlobal))
    rec.set('status', 'error')
    rec.set('status_code', 500)
    rec.set('error_message', String(errGlobal))
    rec.set('raw_debug', debugLog)
    appId.save(rec)
  }
}, 'ml_catalog_search_jobs')
