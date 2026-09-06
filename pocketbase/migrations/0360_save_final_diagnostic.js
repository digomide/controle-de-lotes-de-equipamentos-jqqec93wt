migrate(
  (app) => {
    let token = ''
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (sRecords && sRecords.length > 0) {
      token = sRecords[0].getString('access_token')
    }

    const catalogId = 'MLB2010733747'
    const authHeaders = { Authorization: 'Bearer ' + token, Accept: 'application/json' }

    // 1. /products/MLB2010733747/items
    const r = $http.send({
      url: 'https://api.mercadolibre.com/products/' + catalogId + '/items',
      method: 'GET',
      headers: authHeaders,
      timeout: 10,
    })

    // 2. /items/MLB5193740831/price_to_win?siteId=MLB&version=v2
    let ptw = null
    try {
      const ptwRes = $http.send({
        url: 'https://api.mercadolibre.com/items/MLB5193740831/price_to_win?siteId=MLB&version=v2',
        method: 'GET',
        headers: authHeaders,
        timeout: 10,
      })
      if (ptwRes.statusCode === 200) {
        ptw = ptwRes.json
      }
    } catch (_) {}

    // 3. /products/MLB18732668/items (posição original que o usuário viu)
    let p18 = null
    try {
      const p18Res = $http.send({
        url: 'https://api.mercadolibre.com/products/MLB18732668/items',
        method: 'GET',
        headers: authHeaders,
        timeout: 10,
      })
      if (p18Res.statusCode === 200) {
        p18 = p18Res.json
      }
    } catch (_) {}

    const col = app.findCollectionByNameOrId('ml_competitor_jobs')
    const rRecord = new Record(col)
    rRecord.set('action', 'resolve_from_item')
    rRecord.set('query', 'FINAL_DIAGNOSTIC_SUMMARY')
    rRecord.set('status', 'done')
    rRecord.set('status_code', 200)
    rRecord.set('result_data', {
      catalog_items_2010733747: r.json,
      price_to_win: ptw,
      catalog_items_18732668: p18,
    })
    app.save(rRecord)
  },
  (app) => {},
)
