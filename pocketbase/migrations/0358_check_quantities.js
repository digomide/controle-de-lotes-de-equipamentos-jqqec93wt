migrate(
  (app) => {
    let token = ''
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (sRecords && sRecords.length > 0) {
      token = sRecords[0].getString('access_token')
    }

    const catalogId = 'MLB2010733747'
    const authHeaders = { Authorization: 'Bearer ' + token, Accept: 'application/json' }

    const r = $http.send({
      url: 'https://api.mercadolibre.com/products/' + catalogId + '/items',
      method: 'GET',
      headers: authHeaders,
      timeout: 10,
    })

    let out = ''
    if (r.statusCode === 200 && r.json && Array.isArray(r.json.results)) {
      for (let i = 0; i < r.json.results.length; i++) {
        const it = r.json.results[i]
        out +=
          'Item ' +
          it.item_id +
          ': R$' +
          it.price +
          ' qty=' +
          it.available_quantity +
          ' type=' +
          it.listing_type_id +
          ' bb=' +
          it.is_buy_box_winner +
          ' | '
      }
    }

    const job = app.findRecordById('ml_competitor_jobs', 'wp8elpqepb1vao9')
    job.set('error_message', out)
    app.save(job)
  },
  (app) => {},
)
