migrate(
  (app) => {
    // 1. Carregar token ML
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    const token = sRecords[0].getString('access_token')

    // 2. GET /products/search com filtros de atributos:
    // Ex: ITEM_CONDITION, GRADING, etc.
    const resFilters = $http.send({
      url:
        'https://api.mercadolibre.com/products/search?status=active&site_id=MLB&q=' +
        encodeURIComponent('Dell Latitude 5420'),
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 15,
    })

    const filters =
      resFilters.json && resFilters.json.available_filters ? resFilters.json.available_filters : []
    const appliedFilters = resFilters.json && resFilters.json.filters ? resFilters.json.filters : []

    const col = app.findCollectionByNameOrId('ml_ads_fetch_jobs')
    const report = new Record(col)
    report.set('status', 'done')
    report.set('status_filter', '__AVAILABLE_FILTERS__')
    report.set('progress_text', 'available_filters count: ' + filters.length)
    report.set(
      'error_message',
      JSON.stringify({
        applied: appliedFilters,
        filters: filters.map((f) => ({
          id: f.id,
          name: f.name,
          values: (f.values || []).slice(0, 5),
        })),
      }).substring(0, 3990),
    )
    app.save(report)
  },
  (app) => {},
)
