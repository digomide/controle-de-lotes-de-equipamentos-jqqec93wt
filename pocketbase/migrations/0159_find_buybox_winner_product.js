migrate(
  (app) => {
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    const token = sRecords[0].getString('access_token')

    const res = $http.send({
      url: 'https://api.mercadolibre.com/products/search?status=active&site_id=MLB&domain_id=MLB-NOTEBOOKS&q=dell%20latitude%205420&limit=30&offset=0',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 10,
    })

    let withBB = []
    if (res.statusCode === 200 && res.json && res.json.results) {
      for (let i = 0; i < res.json.results.length; i++) {
        const p = res.json.results[i]
        if (p.buy_box_winner) {
          withBB.push({
            id: p.id,
            name: p.name,
            bb: p.buy_box_winner,
          })
        }
      }
    }

    // Se achou produto com buy_box_winner, chamar /products/{id}/items desse produto
    let winnerItemsEndpoint = null
    if (withBB.length > 0) {
      const winnerCatId = withBB[0].id
      try {
        const iRes = $http.send({
          url: 'https://api.mercadolibre.com/products/' + winnerCatId + '/items',
          method: 'GET',
          headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
          timeout: 10,
        })
        winnerItemsEndpoint = {
          statusCode: iRes.statusCode,
          json: iRes.json || String(iRes.raw || '').substring(0, 300),
        }
      } catch (e) {
        winnerItemsEndpoint = { error: String(e) }
      }
    }

    const job = app.findFirstRecordByData('ml_catalog_search_jobs', 'id', 'szg3o742i7qawmh')
    job.set(
      'error_message',
      JSON.stringify({
        totalWithBB: withBB.length,
        firstBB: withBB[0] || null,
        itemsEndpoint: winnerItemsEndpoint,
      }),
    )
    app.save(job)
  },
  (app) => {},
)
