migrate(
  (app) => {
    // 0080_test_items_multiget_probe.js
    let accessToken = ''
    try {
      const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
      if (sRecords && sRecords.length > 0) {
        accessToken = (sRecords[0].getString('access_token') || '').trim()
      }
    } catch (_) {}

    const col = app.findCollectionByNameOrId('ml_competitor_jobs')
    const job = new Record(col)
    job.set('action', 'search_query')
    job.set('status', 'processing')
    job.set('query', 'probe_multiget_items')

    const resObj = {}
    const ids = ['MLB2752099689', 'MLB1629075678', 'MLB4709060403']

    // Teste 1: multiget com access token
    try {
      const r1 = $http.send({
        url: 'https://api.mercadolibre.com/items?ids=' + ids.join(','),
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer ' + accessToken,
        },
        timeout: 15,
      })
      resObj.withToken = {
        status: r1.statusCode,
        items: Array.isArray(r1.json)
          ? r1.json.map((x) => ({
              code: x.code,
              id: x.body ? x.body.id : null,
              seller_id: x.body ? x.body.seller_id : null,
              title: x.body ? x.body.title : null,
              price: x.body ? x.body.price : null,
              status: x.body ? x.body.status : null,
            }))
          : r1.raw.substring(0, 200),
      }
    } catch (e1) {
      resObj.withToken = { err: String(e1) }
    }

    // Teste 2: multiget sem token
    try {
      const r2 = $http.send({
        url: 'https://api.mercadolibre.com/items?ids=' + ids.join(','),
        method: 'GET',
        headers: { Accept: 'application/json' },
        timeout: 15,
      })
      resObj.noToken = {
        status: r2.statusCode,
        items: Array.isArray(r2.json)
          ? r2.json.map((x) => ({
              code: x.code,
              id: x.body ? x.body.id : null,
              seller_id: x.body ? x.body.seller_id : null,
              title: x.body ? x.body.title : null,
              price: x.body ? x.body.price : null,
              status: x.body ? x.body.status : null,
            }))
          : r2.raw.substring(0, 200),
      }
    } catch (e2) {
      resObj.noToken = { err: String(e2) }
    }

    // Teste 3: GET direto /items/MLB2752099689
    try {
      const r3 = $http.send({
        url: 'https://api.mercadolibre.com/items/MLB2752099689',
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer ' + accessToken,
        },
        timeout: 15,
      })
      resObj.single_MLB2752099689 = {
        status: r3.statusCode,
        id: r3.json ? r3.json.id : null,
        seller_id: r3.json ? r3.json.seller_id : null,
      }
    } catch (e3) {
      resObj.single_MLB2752099689 = { err: String(e3) }
    }

    // Teste 4: GET direto /items/MLB4709060403
    try {
      const r4 = $http.send({
        url: 'https://api.mercadolibre.com/items/MLB4709060403',
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer ' + accessToken,
        },
        timeout: 15,
      })
      resObj.single_MLB4709060403 = {
        status: r4.statusCode,
        id: r4.json ? r4.json.id : null,
        error: r4.json ? r4.json.error : null,
        message: r4.json ? r4.json.message : null,
      }
    } catch (e4) {
      resObj.single_MLB4709060403 = { err: String(e4) }
    }

    job.set('result_data', resObj)
    job.set('status', 'done')
    app.save(job)
  },
  (app) => {},
)
