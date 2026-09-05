migrate(
  (app) => {
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    const token = sRecords[0].getString('access_token')

    // Buscar produtos com "recondicionado" em /products/search
    const res = $http.send({
      url: 'https://api.mercadolibre.com/products/search?status=active&site_id=MLB&q=recondicionado&limit=15&offset=0',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 10,
    })

    let sample = []
    if (res.statusCode === 200 && res.json && res.json.results) {
      for (let i = 0; i < res.json.results.length; i++) {
        const p = res.json.results[i]
        sample.push({
          id: p.id,
          name: p.name,
          domain_id: p.domain_id,
          bb: p.buy_box_winner,
          price: p.price,
          attrs: (p.attributes || []).map((a) => a.id + '=' + a.value_name).slice(0, 10),
        })
      }
    }

    const job = app.findFirstRecordByData('ml_catalog_search_jobs', 'id', 'szg3o742i7qawmh')
    job.set(
      'error_message',
      JSON.stringify({
        count: sample.length,
        sample: sample.slice(0, 5),
      }),
    )
    app.save(job)
  },
  (app) => {},
)
