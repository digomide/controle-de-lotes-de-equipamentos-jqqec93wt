migrate(
  (app) => {
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    const token = sRecords[0].getString('access_token')

    const res = $http.send({
      url: 'https://api.mercadolibre.com/products/search?status=active&site_id=MLB&domain_id=MLB-NOTEBOOKS&q=dell%20latitude%203420&limit=5&offset=0',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 10,
    })

    let attrIds = []
    if (res.statusCode === 200 && res.json && res.json.results) {
      const p = res.json.results[0]
      if (p && Array.isArray(p.attributes)) {
        attrIds = p.attributes.map((a) => a.id)
      }
    }

    const job = app.findFirstRecordByData('ml_catalog_search_jobs', 'id', 'szg3o742i7qawmh')
    job.set(
      'error_message',
      JSON.stringify({
        attrCount: attrIds.length,
        attrIds: attrIds,
      }),
    )
    app.save(job)
  },
  (app) => {},
)
