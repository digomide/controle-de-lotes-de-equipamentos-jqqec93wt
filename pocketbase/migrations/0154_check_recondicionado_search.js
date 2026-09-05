migrate(
  (app) => {
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    const token = sRecords[0].getString('access_token')

    const res = $http.send({
      url: 'https://api.mercadolibre.com/products/search?status=active&site_id=MLB&q=recondicionado&limit=10&offset=0',
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/json',
      },
      timeout: 10,
    })

    let foundCond = []
    if (res.statusCode === 200 && res.json && res.json.results) {
      for (let i = 0; i < res.json.results.length; i++) {
        const p = res.json.results[i]
        let c = null
        if (p.attributes) {
          for (let a = 0; a < p.attributes.length; a++) {
            if (
              p.attributes[a].id.indexOf('COND') >= 0 ||
              p.attributes[a].id.indexOf('ITEM') >= 0
            ) {
              c = p.attributes[a]
            }
          }
        }
        if (c || p.buy_box_winner || p.condition) {
          foundCond.push({
            id: p.id,
            name: p.name,
            c: c,
            bb: p.buy_box_winner,
            rootCond: p.condition,
          })
        }
      }
    }

    const job = app.findFirstRecordByData('ml_catalog_search_jobs', 'id', 'szg3o742i7qawmh')
    job.set(
      'error_message',
      JSON.stringify({
        countFound: foundCond.length,
        found: foundCond,
      }),
    )
    app.save(job)
  },
  (app) => {},
)
