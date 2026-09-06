migrate(
  (app) => {
    let token = ''
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (sRecords && sRecords.length > 0) {
      token = sRecords[0].getString('access_token')
    }

    const testUrl =
      'https://api.mercadolibre.com/products/search?status=active&site_id=MLB&q=dell%20latitude%205420&limit=3'
    const res = $http.send({
      url: testUrl,
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 10,
    })

    const probe = {
      status: res.statusCode,
      item0_keys: [],
      item0_sold_quantity: null,
      item0_attributes: [],
      product_api_sold_quantity: null,
    }

    if (res.statusCode === 200 && res.json && res.json.results && res.json.results.length > 0) {
      const it0 = res.json.results[0]
      probe.item0_keys = Object.keys(it0)
      probe.item0_sold_quantity = it0.sold_quantity != null ? it0.sold_quantity : undefined
      probe.item0_attributes = (it0.attributes || []).map((a) => ({
        id: a.id,
        name: a.name,
        value_name: a.value_name,
      }))

      // Agora testar GET /products/{id}
      if (it0.id) {
        try {
          const pRes = $http.send({
            url: 'https://api.mercadolibre.com/products/' + it0.id,
            method: 'GET',
            headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
            timeout: 10,
          })
          if (pRes.statusCode === 200 && pRes.json) {
            probe.product_api_keys = Object.keys(pRes.json)
            probe.product_api_sold_quantity = pRes.json.sold_quantity
            probe.product_api_bb_winner = pRes.json.buy_box_winner
          }
        } catch (ep) {
          probe.product_api_err = String(ep)
        }
      }
    }

    const job = app.findRecordById('ml_competitor_jobs', 'wp8elpqepb1vao9')
    job.set('error_message', JSON.stringify(probe).substring(0, 3000))
    app.save(job)
  },
  (app) => {},
)
