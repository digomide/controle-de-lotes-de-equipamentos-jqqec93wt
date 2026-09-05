migrate(
  (app) => {
    const rec = app.findFirstRecordByFilter(
      'ml_ads_fetch_jobs',
      "status_filter = '__DIAG_INSPIRON_3576__'",
    )
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    let token = sRecords.length > 0 ? sRecords[0].getString('access_token') : ''

    let searchTests = {}
    if (token) {
      const queries = ['dell inspiron 3576', 'inspiron 3576', 'dell 3576', 'dell inspiron 15 3576']
      queries.forEach((q) => {
        try {
          const res = $http.send({
            url:
              'https://api.mercadolibre.com/products/search?status=active&site_id=MLB&q=' +
              encodeURIComponent(q) +
              '&limit=5',
            method: 'GET',
            headers: { Authorization: 'Bearer ' + token },
            timeout: 10,
          })
          searchTests[q] = {
            status: res.statusCode,
            total: res.json && res.json.paging ? res.json.paging.total : 0,
            ids:
              res.json && res.json.results ? res.json.results.map((r) => r.id + ': ' + r.name) : [],
          }
        } catch (e) {
          searchTests[q] = { error: String(e) }
        }
      })
    }

    rec.set(
      'progress_text',
      'searchTests: ' +
        Object.keys(searchTests)
          .map((k) => k + '->' + searchTests[k].total)
          .join('; '),
    )
    rec.set('error_message', JSON.stringify(searchTests))
    app.save(rec)
  },
  (app) => {},
)
