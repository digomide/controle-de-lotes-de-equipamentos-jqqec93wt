migrate(
  (app) => {
    // 0083_run_direct_call.js
    let accessToken = ''
    try {
      const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
      if (sRecords && sRecords.length > 0) {
        accessToken = (sRecords[0].getString('access_token') || '').trim()
      }
    } catch (_) {}

    const col = app.findCollectionByNameOrId('ml_competitor_jobs')
    const job = new Record(col)
    job.set('action', 'search_query')
    job.set('status', 'done')
    job.set('query', 'direct_token_test')

    // Chamar multiget com token
    const res = $http.send({
      url: 'https://api.mercadolibre.com/items?ids=MLB2752099689,MLB4709060403',
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer ' + accessToken,
      },
      timeout: 15,
    })

    const bodyPreview = res.raw ? res.raw.substring(0, 800) : ''
    job.set(
      'error_message',
      (
        'Status: ' +
        res.statusCode +
        ' | TokenLen: ' +
        accessToken.length +
        ' | ' +
        bodyPreview
      ).substring(0, 500),
    )
    app.save(job)
  },
  (app) => {},
)
