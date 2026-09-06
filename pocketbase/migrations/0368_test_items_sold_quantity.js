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
    // items disputando o produto
    const itRes = $http.send({
      url: 'https://api.mercadolibre.com/products/' + catId + '/items',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 10,
    })

    const info = {
      prod_id: catId,
      prod_sold_quantity: it0.sold_quantity,
      prod_keys: Object.keys(it0),
      items_results_count: itRes.json ? (itRes.json.results || []).length : 0,
      item0_items:
        itRes.json && itRes.json.results && itRes.json.results.length > 0
          ? itRes.json.results[0]
          : null,
    }

    const job = app.findRecordById('ml_competitor_jobs', 'wp8elpqepb1vao9')
    job.set(
      'error_message',
      'prod_sold=' +
        info.prod_sold_quantity +
        ' | keys=' +
        info.prod_keys.join(',') +
        ' | item0_sold=' +
        (info.item0_items ? info.item0_items.sold_quantity : 'null'),
    )
    app.save(job)
  },
  (app) => {},
)
