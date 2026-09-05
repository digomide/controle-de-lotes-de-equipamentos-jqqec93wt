migrate(
  (app) => {
    // 1. Carregar token ML
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    const token = sRecords[0].getString('access_token')

    // 2. GET /items/MLB7566367408
    const res = $http.send({
      url: 'https://api.mercadolibre.com/items/MLB7566367408',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 10,
    })

    const catId = res.json ? res.json.catalog_product_id : null

    // 3. Atualizar um job de teste com o resultado
    const searchJobs = app.findRecordsByFilter(
      'ml_catalog_search_jobs',
      "query = '__DIAGNOSTIC_5420__'",
      '',
      1,
      0,
    )
    if (searchJobs.length > 0) {
      searchJobs[0].set('progress_text', 'item 7566 catId: ' + catId)
      searchJobs[0].set(
        'error_message',
        JSON.stringify({
          id: res.json ? res.json.id : null,
          catalog_product_id: catId,
          catalog_listing: res.json ? res.json.catalog_listing : null,
          condition: res.json ? res.json.condition : null,
        }),
      )
      app.save(searchJobs[0])
    }
  },
  (app) => {},
)
