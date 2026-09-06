migrate(
  (app) => {
    let token = ''
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (sRecords && sRecords.length > 0) {
      token = sRecords[0].getString('access_token')
    }

    const testUrl =
      'https://api.mercadolibre.com/products/search?status=active&site_id=MLB&q=dell%20latitude%205420&limit=1'
    const res = $http.send({
      url: testUrl,
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 10,
    })

    const it0 = res.json.results[0]
    const catId = it0.id
    const itRes = $http.send({
      url: 'https://api.mercadolibre.com/products/' + catId + '/items',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 10,
    })

    let itDetail = null
    let itemsResults = (itRes.json && itRes.json.results) || []
    if (itemsResults.length > 0 && itemsResults[0].item_id) {
      const itId = itemsResults[0].item_id
      const singleItemRes = $http.send({
        url:
          'https://api.mercadolibre.com/items/' +
          itId +
          '?attributes=id,sold_quantity,sold_quantity_mercadopago,available_quantity,price,title',
        method: 'GET',
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
        timeout: 10,
      })
      itDetail = singleItemRes.json
    }

    const job = app.findRecordById('ml_competitor_jobs', 'wp8elpqepb1vao9')
    job.set(
      'error_message',
      'items_count=' +
        itemsResults.length +
        ' | first_item=' +
        JSON.stringify(itemsResults[0]) +
        ' | singleItem=' +
        JSON.stringify(itDetail),
    )
    app.save(job)
  },
  (app) => {},
)
