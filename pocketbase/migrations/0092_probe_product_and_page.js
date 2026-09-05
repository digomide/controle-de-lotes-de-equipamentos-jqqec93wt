migrate(
  (app) => {
    // 0092_probe_product_and_page.js
    const col = app.findCollectionByNameOrId('ml_competitor_jobs')
    const job = new Record(col)
    job.set('action', 'search_query')
    job.set('status', 'processing')
    job.set('query', 'probe_mlb_sources_2010941196')

    let accessToken = ''
    try {
      const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
      if (sRecords && sRecords.length > 0) {
        accessToken = (sRecords[0].getString('access_token') || '').trim()
      }
    } catch (_) {}

    const results = {}

    // 1. Testar endpoint /products/MLB2010941196
    try {
      const pRes1 = $http.send({
        url: 'https://api.mercadolibre.com/products/MLB2010941196',
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...(accessToken ? { Authorization: 'Bearer ' + accessToken } : {}),
        },
        timeout: 10,
      })
      results.productEndpointAuth = {
        status: pRes1.statusCode,
        name: pRes1.json ? pRes1.json.name || pRes1.json.title : null,
        keys: pRes1.json ? Object.keys(pRes1.json).slice(0, 10) : null,
      }
    } catch (e1) {
      results.productEndpointAuth = { err: String(e1) }
    }

    // 2. Testar endpoint /products/MLB2010941196 SEM token
    try {
      const pRes2 = $http.send({
        url: 'https://api.mercadolibre.com/products/MLB2010941196',
        method: 'GET',
        headers: { Accept: 'application/json' },
        timeout: 10,
      })
      results.productEndpointNoToken = {
        status: pRes2.statusCode,
        name: pRes2.json ? pRes2.json.name || pRes2.json.title : null,
      }
    } catch (e2) {
      results.productEndpointNoToken = { err: String(e2) }
    }

    // 3. Testar HTML completo da URL real
    const realUrl =
      'https://www.mercadolivre.com.br/dell-g7-15-i7-1135g7-16gb-256-m2-cor-preto-excelente-recondicionado/p/MLB2010941196'
    try {
      const pageRes = $http.send({
        url: realUrl,
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
        timeout: 15,
      })

      const raw = pageRes.raw || ''
      results.realPage = {
        status: pageRes.statusCode,
        length: raw.length,
        hasOgTitle: raw.includes('og:title'),
        hasOgPrice: raw.includes('product:price') || raw.includes('price:amount'),
        hasOgImage: raw.includes('og:image'),
        hasSchemaOrg: raw.includes('schema.org'),
        hasApplicationLdJson: raw.includes('application/ld+json'),
        hasPreloadedState: raw.includes('__PRELOADED_STATE__'),
        hasSeller: raw.includes('seller_id') || raw.includes('sellerId') || raw.includes('seller'),
      }

      // Extrair meta tags og
      const ogTitleM =
        raw.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
        raw.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)
      results.realPage.ogTitle = ogTitleM ? ogTitleM[1] : null

      const ogImageM =
        raw.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
        raw.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
      results.realPage.ogImage = ogImageM ? ogImageM[1] : null

      const ogPriceM =
        raw.match(
          /<meta[^>]+property=["'](?:product:price:amount|price:amount)["'][^>]+content=["']([^"']+)["']/i,
        ) ||
        raw.match(
          /<meta[^>]+content=["']([^"']+)["'][^>]+property=["'](?:product:price:amount|price:amount)["']/i,
        )
      results.realPage.ogPrice = ogPriceM ? ogPriceM[1] : null

      // Procurar scripts ld+json
      const ldMatches = raw.match(
        /<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi,
      )
      results.realPage.ldJsonCount = ldMatches ? ldMatches.length : 0
      if (ldMatches && ldMatches.length > 0) {
        results.realPage.ldSample = ldMatches[0].substring(0, 300)
      }

      // Procurar outros trechos de JSON na página
      const priceRegexMatches = raw.match(/"price":\s*([0-9]+(?:\.[0-9]+)?)/g)
      results.realPage.priceMatches = priceRegexMatches ? priceRegexMatches.slice(0, 5) : null
    } catch (ePage) {
      results.realPage = { err: String(ePage) }
    }

    job.set('result_data', results)
    job.set('status', 'done')
    app.save(job)
  },
  (app) => {},
)
