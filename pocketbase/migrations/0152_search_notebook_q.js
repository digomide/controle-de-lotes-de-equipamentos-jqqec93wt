migrate(
  (app) => {
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    const token = sRecords[0].getString('access_token')

    const res = $http.send({
      url: 'https://api.mercadolibre.com/products/search?status=active&site_id=MLB&q=notebook&limit=50&offset=0',
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/json',
      },
      timeout: 10,
    })

    let withBB = 0
    let withConditionAttr = 0
    let sampleKeys = []

    if (res.statusCode === 200 && res.json && res.json.results) {
      for (let i = 0; i < res.json.results.length; i++) {
        const p = res.json.results[i]
        if (i === 0) sampleKeys = Object.keys(p)
        if (p.buy_box_winner) withBB++
        if (p.attributes) {
          for (let a = 0; a < p.attributes.length; a++) {
            if (
              p.attributes[a].id.indexOf('COND') >= 0 ||
              p.attributes[a].id.indexOf('ITEM') >= 0
            ) {
              withConditionAttr++
            }
          }
        }
      }
    }

    const job = app.findFirstRecordByData('ml_catalog_search_jobs', 'id', 'szg3o742i7qawmh')
    job.set(
      'error_message',
      JSON.stringify({
        totalReturned: res.json ? (res.json.results || []).length : 0,
        withBB: withBB,
        withConditionAttr: withConditionAttr,
        sampleKeys: sampleKeys,
      }),
    )
    app.save(job)
  },
  (app) => {},
)
