migrate(
  (app) => {
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    let token = sRecords.length > 0 ? sRecords[0].getString('access_token') : ''
    let res = null
    if (token) {
      try {
        const q = $http.send({
          url:
            'https://api.mercadolibre.com/products/search?status=active&site_id=MLB&q=' +
            encodeURIComponent('dell inspiron 3576 recondicionado') +
            '&limit=10',
          method: 'GET',
          headers: { Authorization: 'Bearer ' + token },
          timeout: 10,
        })
        res = {
          statusCode: q.statusCode,
          total: q.json ? (q.json.paging ? q.json.paging.total : 0) : 0,
          results: q.json
            ? (q.json.results || []).map((r) => ({
                id: r.id,
                name: r.name,
                condition: r.condition,
              }))
            : [],
        }
      } catch (e) {
        res = { error: String(e) }
      }
    }

    const rec = app.findFirstRecordByFilter(
      'ml_ads_fetch_jobs',
      "status_filter = '__DIAG_INSPIRON_3576__'",
    )
    rec.set('progress_text', 'search test: total ' + (res ? res.total : 'err'))
    rec.set('error_message', JSON.stringify(res))
    app.save(rec)
  },
  (app) => {},
)
