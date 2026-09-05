migrate(
  (app) => {
    // 1. Carregar token ML
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    const token = sRecords[0].getString('access_token')

    // 2. Testar apenas 2 chamadas rápidas com timeout curto
    const q1 = 'Dell Latitude 5420 Excelente'
    let has2097 = false
    try {
      const res = $http.send({
        url:
          'https://api.mercadolibre.com/products/search?status=active&site_id=MLB&q=' +
          encodeURIComponent(q1) +
          '&limit=50',
        method: 'GET',
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
        timeout: 5,
      })
      if (res.statusCode === 200 && res.json && Array.isArray(res.json.results)) {
        has2097 = res.json.results.some((x) => x.id === 'MLB2097858038')
      }
    } catch (_) {}

    const job = app.findFirstRecordByData('ml_catalog_search_jobs', 'id', 'xqrcjlbvnzhwqfe')
    job.set('progress_text', 'q1 has2097: ' + has2097)
    app.save(job)
  },
  (app) => {},
)
