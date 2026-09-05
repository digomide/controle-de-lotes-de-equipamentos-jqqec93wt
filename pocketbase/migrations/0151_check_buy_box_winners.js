migrate(
  (app) => {
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    const token = sRecords[0].getString('access_token')

    const res = $http.send({
      url: 'https://api.mercadolibre.com/products/search?status=active&site_id=MLB&domain_id=MLB-NOTEBOOKS&q=dell%20latitude%203420&limit=50&offset=0',
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/json',
      },
      timeout: 10,
    })

    let buyBoxConditions = []
    if (res.statusCode === 200 && res.json && res.json.results) {
      for (let i = 0; i < res.json.results.length; i++) {
        const p = res.json.results[i]
        if (p.buy_box_winner) {
          buyBoxConditions.push({
            id: p.id,
            name: (p.name || '').substring(0, 30),
            bb_condition: p.buy_box_winner.condition || null,
            bb_price: p.buy_box_winner.price,
            bb_keys: Object.keys(p.buy_box_winner),
          })
        }
      }
    }

    const job = app.findFirstRecordByData('ml_catalog_search_jobs', 'id', 'szg3o742i7qawmh')
    job.set(
      'error_message',
      JSON.stringify({
        totalWithBB: buyBoxConditions.length,
        samples: buyBoxConditions.slice(0, 5),
      }),
    )
    app.save(job)
  },
  (app) => {},
)
