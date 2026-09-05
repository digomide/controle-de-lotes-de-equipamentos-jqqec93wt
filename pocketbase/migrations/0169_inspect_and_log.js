migrate(
  (app) => {
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    const token = sRecords[0].getString('access_token')

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
          bb: p.buy_box_winner,
          price: p.price,
        })
      }
    }

    console.log(
      '[inspect_0169] Count: ' + sample.length + ' JSON: ' + JSON.stringify(sample.slice(0, 3)),
    )
  },
  (app) => {},
)
