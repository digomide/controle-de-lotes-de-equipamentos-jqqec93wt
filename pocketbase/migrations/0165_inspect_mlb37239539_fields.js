migrate(
  (app) => {
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    const token = sRecords[0].getString('access_token')

    const res = $http.send({
      url: 'https://api.mercadolibre.com/products/MLB37239539',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 10,
    })

    let p = res.json || {}

    const job = app.findFirstRecordByData('ml_catalog_search_jobs', 'id', 'szg3o742i7qawmh')
    job.set(
      'error_message',
      JSON.stringify({
        quality_type: p.quality_type,
        type: p.type,
        tags: p.tags,
        status: p.status,
        children_ids: p.children_ids,
        parent_id: p.parent_id,
        disclaimers: p.disclaimers,
        main_features: p.main_features,
      }),
    )
    app.save(job)
  },
  (app) => {},
)
