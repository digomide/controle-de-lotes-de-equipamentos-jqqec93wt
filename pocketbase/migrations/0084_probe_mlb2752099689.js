migrate(
  (app) => {
    // 0084_probe_mlb2752099689.js
    const job = app.findFirstRecordByData('ml_competitor_jobs', 'query', 'direct_token_test')
    let accessToken = ''
    try {
      const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
      if (sRecords && sRecords.length > 0) {
        accessToken = (sRecords[0].getString('access_token') || '').trim()
      }
    } catch (_) {}

    const res = $http.send({
      url: 'https://api.mercadolibre.com/items?ids=MLB2752099689',
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer ' + accessToken,
      },
      timeout: 15,
    })

    const data = res.json || []
    const first = data[0] || {}
    job.set(
      'error_message',
      JSON.stringify({
        code: first.code,
        id: first.body ? first.body.id : null,
        seller_id: first.body ? first.body.seller_id : null,
        title: first.body ? first.body.title : null,
        price: first.body ? first.body.price : null,
        status: first.body ? first.body.status : null,
        attributes_sample:
          first.body && first.body.attributes ? first.body.attributes.slice(0, 3) : null,
      }).substring(0, 500),
    )
    app.save(job)
  },
  (app) => {},
)
