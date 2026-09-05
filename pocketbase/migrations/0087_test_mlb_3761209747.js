migrate(
  (app) => {
    // 0087_test_mlb_3761209747.js
    let accessToken = ''
    try {
      const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
      if (sRecords && sRecords.length > 0) {
        accessToken = (sRecords[0].getString('access_token') || '').trim()
      }
    } catch (_) {}

    const job = app.findFirstRecordByData('ml_competitor_jobs', 'query', 'direct_token_test')

    const res = $http.send({
      url: 'https://api.mercadolibre.com/items?ids=MLB3761209747',
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer ' + accessToken,
      },
      timeout: 15,
    })

    const results = (res.json || []).map((x) => ({
      code: x.code,
      id: x.body ? x.body.id : null,
      status: x.body ? x.body.status : null,
      title: x.body ? x.body.title : null,
      seller_id: x.body ? x.body.seller_id : null,
      price: x.body ? x.body.price : null,
      sold_quantity: x.body ? x.body.sold_quantity : null,
    }))

    job.set('error_message', JSON.stringify(results).substring(0, 500))
    app.save(job)
  },
  (app) => {},
)
