migrate(
  (app) => {
    // 0071_test_ml_endpoints.js
    const col = app.findCollectionByNameOrId('ml_competitor_jobs')
    const job = new Record(col)
    job.set('action', 'search_query')
    job.set('status', 'processing')

    let accessToken = ''
    try {
      const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
      if (sRecords && sRecords.length > 0) {
        accessToken = (sRecords[0].getString('access_token') || '').trim()
      }
    } catch (_) {}

    const resObj = {}

    // 1. /users/626774396
    try {
      const rC = $http.send({
        url: 'https://api.mercadolibre.com/users/626774396',
        method: 'GET',
        headers: { Accept: 'application/json' },
        timeout: 10,
      })
      resObj.rC_user = {
        status: rC.statusCode,
        nickname: rC.json ? rC.json.nickname : null,
        permalink: rC.json ? rC.json.permalink : null,
      }
    } catch (eC) {
      resObj.rC_user = { err: String(eC) }
    }

    // 2. /users/626774396/items/search SEM TOKEN
    try {
      const rD1 = $http.send({
        url: 'https://api.mercadolibre.com/users/626774396/items/search?search_type=scan&limit=2',
        method: 'GET',
        headers: { Accept: 'application/json' },
        timeout: 10,
      })
      resObj.rD1_noToken = { status: rD1.statusCode, raw: rD1.raw ? rD1.raw.substring(0, 100) : '' }
    } catch (eD1) {
      resObj.rD1_noToken = { err: String(eD1) }
    }

    // 3. /users/626774396/items/search COM TOKEN
    try {
      const rD2 = $http.send({
        url: 'https://api.mercadolibre.com/users/626774396/items/search?search_type=scan&limit=2',
        method: 'GET',
        headers: { Accept: 'application/json', Authorization: 'Bearer ' + accessToken },
        timeout: 10,
      })
      resObj.rD2_withToken = {
        status: rD2.statusCode,
        results_len: rD2.json && Array.isArray(rD2.json.results) ? rD2.json.results.length : 0,
      }
    } catch (eD2) {
      resObj.rD2_withToken = { err: String(eD2) }
    }

    // 4. Testar outros endpoints públicos
    // /sites/MLB/domain_discovery/search?q=Thinkpad
    try {
      const rF = $http.send({
        url: 'https://api.mercadolibre.com/sites/MLB/domain_discovery/search?q=Thinkpad',
        method: 'GET',
        headers: { Accept: 'application/json' },
        timeout: 10,
      })
      resObj.domain_discovery = { status: rF.statusCode }
    } catch (eF) {
      resObj.domain_discovery = { err: String(eF) }
    }

    // 5. Testar se existe endpoint de itens de outro seller com token nosso
    // Ex: seller 137452377 (um vendedor público qualquer de exemplo) ou buscar itens de outro usuário
    try {
      const rG = $http.send({
        url: 'https://api.mercadolibre.com/users/137452377/items/search?search_type=scan&limit=2',
        method: 'GET',
        headers: { Accept: 'application/json', Authorization: 'Bearer ' + accessToken },
        timeout: 10,
      })
      resObj.other_seller_items_withToken = {
        status: rG.statusCode,
        raw: rG.raw ? rG.raw.substring(0, 100) : '',
      }
    } catch (eG) {
      resObj.other_seller_items_withToken = { err: String(eG) }
    }

    // 6. Testar /items?ids=MLB7591024470 (sem token e com token)
    try {
      const rH = $http.send({
        url: 'https://api.mercadolibre.com/items?ids=MLB7591024470',
        method: 'GET',
        headers: { Accept: 'application/json' },
        timeout: 10,
      })
      resObj.items_noToken = { status: rH.statusCode, json: rH.json ? rH.json[0]?.code : null }
    } catch (eH) {
      resObj.items_noToken = { err: String(eH) }
    }

    // 7. Testar busca pública web (scraping de segurança caso a API seja fechada para search)
    // https://lista.mercadolivre.com.br/thinkpad ou https://lista.mercadolivre.com.br/_CustId_626774396
    try {
      const rWeb = $http.send({
        url: 'https://lista.mercadolivre.com.br/_CustId_626774396',
        method: 'GET',
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 15,
      })
      resObj.web_seller_page = { status: rWeb.statusCode, len: rWeb.raw ? rWeb.raw.length : 0 }
    } catch (eW) {
      resObj.web_seller_page = { err: String(eW) }
    }

    job.set('result_data', resObj)
    job.set('status', 'done')
    job.set('query', 'probe_diagnostics_2')
    app.save(job)
  },
  (app) => {},
)
