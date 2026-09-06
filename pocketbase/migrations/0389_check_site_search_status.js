migrate(
  (app) => {
    let token = ''
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (sRecords && sRecords.length > 0) {
      token = sRecords[0].getString('access_token')
    }

    const testUrl = 'https://api.mercadolibre.com/sites/MLB/search?q=dell%20latitude%203420&limit=5'
    const sRes = $http.send({
      url: testUrl,
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 10,
    })

    const bodyStr = JSON.stringify(sRes.json || {}).substring(0, 500)
    const line = 'status=' + sRes.statusCode + ' body=' + bodyStr

    const job = app.findRecordById('ml_competitor_jobs', 'wp8elpqepb1vao9')
    job.set('seller_nickname', line.substring(0, 250))
    app.save(job)
  },
  (app) => {},
)
