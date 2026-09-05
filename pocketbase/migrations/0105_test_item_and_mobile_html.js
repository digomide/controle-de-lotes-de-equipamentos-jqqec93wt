migrate(
  (app) => {
    // 0105_test_item_and_mobile_html.js
    const job = app.findFirstRecordByData(
      'ml_competitor_jobs',
      'query',
      'probe_mlb_sources_2010941196',
    )

    let accessToken = ''
    try {
      const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
      if (sRecords && sRecords.length > 0) {
        accessToken = (sRecords[0].getString('access_token') || '').trim()
      }
    } catch (_) {}

    const results = {}

    // Teste 1: GET /items/MLB4836138319 com e sem token
    try {
      const iRes1 = $http.send({
        url: 'https://api.mercadolibre.com/items/MLB4836138319',
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer ' + accessToken,
        },
        timeout: 10,
      })
      results.itemWithToken = {
        status: iRes1.statusCode,
        title: iRes1.json ? iRes1.json.title : null,
      }
    } catch (e1) {
      results.itemWithToken = { err: String(e1) }
    }

    try {
      const iRes2 = $http.send({
        url: 'https://api.mercadolibre.com/items/MLB4836138319',
        method: 'GET',
        headers: { Accept: 'application/json' },
        timeout: 10,
      })
      results.itemNoToken = {
        status: iRes2.statusCode,
        title: iRes2.json ? iRes2.json.title : null,
      }
    } catch (e2) {
      results.itemNoToken = { err: String(e2) }
    }

    // Teste 2: GET https://produto.mercadolivre.com.br/MLB-4836138319
    try {
      const pRes1 = $http.send({
        url: 'https://produto.mercadolivre.com.br/MLB-4836138319',
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9',
        },
        timeout: 15,
      })
      results.itemPage = {
        status: pRes1.statusCode,
        len: (pRes1.raw || '').length,
        hasTitle: (pRes1.raw || '').includes('<title>'),
        title: ((pRes1.raw || '').match(/<title>([^<]+)<\/title>/i) || [])[1],
        ogTitle: ((pRes1.raw || '').match(
          /property=["']og:title["']\s+content=["']([^"']+)["']/i,
        ) || [])[1],
        ogPrice: ((pRes1.raw || '').match(
          /content=["']([0-9.]+)["']\s+property=["']product:price:amount["']/i,
        ) ||
          (pRes1.raw || '').match(
            /property=["']product:price:amount["']\s+content=["']([0-9.]+)["']/i,
          ) ||
          [])[1],
        hasOgPrice: (pRes1.raw || '').includes('price:amount'),
      }
    } catch (eP) {
      results.itemPage = { err: String(eP) }
    }

    // Teste 3: Mobile User-Agent para a página do produto
    try {
      const mRes = $http.send({
        url: 'https://www.mercadolivre.com.br/dell-g7-15-i7-1135g7-16gb-256-m2-cor-preto-excelente-recondicionado/p/MLB2010941196',
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9',
        },
        timeout: 15,
      })
      results.mobilePdp = {
        status: mRes.statusCode,
        len: (mRes.raw || '').length,
        title: ((mRes.raw || '').match(/<title>([^<]+)<\/title>/i) || [])[1],
        hasPreload: (mRes.raw || '').includes('__PRELOADED_STATE__'),
        hasLd: (mRes.raw || '').includes('application/ld+json'),
      }
    } catch (eM) {
      results.mobilePdp = { err: String(eM) }
    }

    job.set('error_message', JSON.stringify(results).substring(0, 1500))
    app.save(job)
  },
  (app) => {},
)
