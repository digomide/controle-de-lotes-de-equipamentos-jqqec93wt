migrate(
  (app) => {
    // 0241: Testar endpoints derivados e verificar a posição MLB2097858038
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    const token = sRecords.length > 0 ? sRecords[0].getString('access_token') : ''

    let p2097 = null
    try {
      const res = $http.send({
        url: 'https://api.mercadolibre.com/products/MLB2097858038',
        method: 'GET',
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
        timeout: 10,
      })
      if (res.statusCode === 200 && res.json) {
        const d = res.json
        p2097 = {
          id: d.id,
          name: d.name,
          parent_id: d.parent_id,
          children_ids: d.children_ids,
          family_name: d.family_name,
          main_features: d.main_features,
          attributes_count: (d.attributes || []).length,
        }
      }
    } catch (_) {}

    // Buscar anúncios sincronizados locais da tabela ml_ads_fetch_jobs
    const fetchJobs = app.findRecordsByFilter(
      'ml_ads_fetch_jobs',
      "status = 'done' && items_count > 0",
      '-created',
      1,
      0,
    )
    let matchedInFetch = 0
    let matchedItemSample = null
    if (fetchJobs.length > 0) {
      const items = fetchJobs[0].get('items') || []
      for (let i = 0; i < items.length; i++) {
        const it = items[i]
        const titleLower = (it.title || '').toLowerCase()
        if (titleLower.includes('latitude') && titleLower.includes('5420')) {
          matchedInFetch++
          if (!matchedItemSample) matchedItemSample = it
        }
      }
    }

    const col = app.findCollectionByNameOrId('ml_ads_fetch_jobs')
    const report = new Record(col)
    report.set('status', 'done')
    report.set('status_filter', '__PROBE_0241__')
    report.set(
      'progress_text',
      'matchedInFetch: ' + matchedInFetch + ' p2097: ' + (p2097 ? p2097.name : 'null'),
    )
    report.set(
      'error_message',
      JSON.stringify({
        p2097: p2097,
        matchedInFetch: matchedInFetch,
        sample: matchedItemSample,
      }),
    )
    app.save(report)
  },
  (app) => {},
)
