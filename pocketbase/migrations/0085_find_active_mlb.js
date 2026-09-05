migrate(
  (app) => {
    // 0085_find_active_mlb.js
    let accessToken = ''
    try {
      const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
      if (sRecords && sRecords.length > 0) {
        accessToken = (sRecords[0].getString('access_token') || '').trim()
      }
    } catch (_) {}

    const job = app.findFirstRecordByData('ml_competitor_jobs', 'query', 'direct_token_test')

    // Testar alguns IDs de notebooks ou produtos conhecidos
    const testIds = [
      'MLB2752099689',
      'MLB3418652399',
      'MLB3518652399',
      'MLB2000000000',
      'MLB3000000000',
      'MLB3654128912',
      'MLB3891204123',
    ]

    const res = $http.send({
      url: 'https://api.mercadolibre.com/items?ids=' + testIds.join(','),
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
    }))

    job.set('error_message', JSON.stringify(results).substring(0, 500))
    app.save(job)
  },
  (app) => {},
)
