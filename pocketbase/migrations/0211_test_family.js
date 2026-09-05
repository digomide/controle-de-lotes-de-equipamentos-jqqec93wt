migrate(
  (app) => {
    // 1. Carregar token ML
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    const token = sRecords[0].getString('access_token')

    // 2. GET /products/MLB2097858038
    const resProd = $http.send({
      url: 'https://api.mercadolibre.com/products/MLB2097858038',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 15,
    })
    const prod = resProd.json || {}

    // 3. Buscar pelo family_name em /products/search
    const resFamily = $http.send({
      url:
        'https://api.mercadolibre.com/products/search?status=active&site_id=MLB&q=' +
        encodeURIComponent('Dell Latitude 5420') +
        '&limit=50',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 15,
    })

    const familyResults = resFamily.json && resFamily.json.results ? resFamily.json.results : []
    const familyCatalogIds = familyResults.map((r) => r.id + ' | ' + r.name)

    const col = app.findCollectionByNameOrId('ml_ads_fetch_jobs')
    const report = new Record(col)
    report.set('status', 'done')
    report.set('status_filter', '__PROD_FAMILY_RESULTS__')
    report.set(
      'progress_text',
      'family_name: ' +
        prod.family_name +
        ' parent_id: ' +
        prod.parent_id +
        ' type: ' +
        prod.type +
        ' quality_type: ' +
        prod.quality_type,
    )
    report.set(
      'error_message',
      JSON.stringify({
        family_results_count: familyResults.length,
        has_2097: familyCatalogIds.some((s) => s.includes('MLB2097858038')),
        sample_results: familyCatalogIds.slice(0, 15),
      }),
    )
    app.save(report)
  },
  (app) => {},
)
