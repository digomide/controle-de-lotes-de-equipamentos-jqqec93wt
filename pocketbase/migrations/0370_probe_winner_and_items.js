migrate(
  (app) => {
    let token = ''
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (sRecords && sRecords.length > 0) {
      token = sRecords[0].getString('access_token')
    }

    const testUrl =
      'https://api.mercadolibre.com/products/search?status=active&site_id=MLB&q=dell%20latitude%205420&limit=5'
    const res = $http.send({
      url: testUrl,
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 10,
    })

    const list = res.json.results || []
    let foundItems = null
    let foundCatId = null
    let winnerId = null
    for (let i = 0; i < list.length; i++) {
      const p = list[i]
      if (p.buy_box_winner && p.buy_box_winner.item_id) {
        winnerId = p.buy_box_winner.item_id
        foundCatId = p.id
        break
      }
      const itRes = $http.send({
        url: 'https://api.mercadolibre.com/products/' + p.id + '/items',
        method: 'GET',
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
        timeout: 10,
      })
      if (itRes.json && itRes.json.results && itRes.json.results.length > 0) {
        foundItems = itRes.json.results
        foundCatId = p.id
        break
      }
    }

    let winnerItemData = null
    if (winnerId) {
      const wRes = $http.send({
        url:
          'https://api.mercadolibre.com/items/' +
          winnerId +
          '?attributes=id,sold_quantity,sold_quantity_mercadopago,available_quantity,price,title',
        method: 'GET',
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
        timeout: 10,
      })
      winnerItemData = wRes.json
    }

    const job = app.findRecordById('ml_competitor_jobs', 'wp8elpqepb1vao9')
    job.set(
      'error_message',
      'foundCatId=' +
        foundCatId +
        ' | winnerId=' +
        winnerId +
        ' | winnerData=' +
        JSON.stringify(winnerItemData) +
        ' | foundItems=' +
        JSON.stringify(foundItems ? foundItems.slice(0, 2) : null),
    )
    app.save(job)
  },
  (app) => {},
)
