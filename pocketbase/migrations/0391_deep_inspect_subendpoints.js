migrate(
  (app) => {
    let token = ''
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (sRecords && sRecords.length > 0) {
      token = sRecords[0].getString('access_token')
    }

    const catId = 'MLB2097858038'
    const headers = { Authorization: 'Bearer ' + token, Accept: 'application/json' }

    // 1. GET /products/MLB2097858038
    const pRes = $http.send({
      url: 'https://api.mercadolibre.com/products/' + catId,
      method: 'GET',
      headers: headers,
      timeout: 10,
    })
    const pj = pRes.json || {}

    // 2. GET /products/MLB2097858038/items
    const itRes = $http.send({
      url: 'https://api.mercadolibre.com/products/' + catId + '/items',
      method: 'GET',
      headers: headers,
      timeout: 10,
    })
    const itResults = (itRes.json && itRes.json.results) || []

    // 3. Testar outros subendpoints de products/{id}
    const subendpoints = ['reviews', 'trends', 'highlights', 'badges', 'summary']
    const subRes = {}
    for (let s = 0; s < subendpoints.length; s++) {
      const ep = subendpoints[s]
      try {
        const sr = $http.send({
          url: 'https://api.mercadolibre.com/products/' + catId + '/' + ep,
          method: 'GET',
          headers: headers,
          timeout: 5,
        })
        subRes[ep] = { status: sr.statusCode, keys: sr.json ? Object.keys(sr.json) : [] }
        if (sr.json && sr.json.sold_quantity != null) subRes[ep].sold = sr.json.sold_quantity
        if (sr.json && sr.json.total_sold != null) subRes[ep].total_sold = sr.json.total_sold
      } catch (es) {
        subRes[ep] = { err: String(es) }
      }
    }

    const testJob = app.findRecordById('ml_competitor_jobs', 'wp8elpqepb1vao9')
    const finalReport = {
      pj_all_keys: Object.keys(pj),
      pj_buy_box_winner: pj.buy_box_winner,
      pj_main_features: pj.main_features,
      pj_settings: pj.settings,
      itResults_count: itResults.length,
      itResults: itResults,
      subRes: subRes,
    }
    testJob.set('error_message', JSON.stringify(finalReport).substring(0, 3500))
    app.save(testJob)
  },
  (app) => {},
)
