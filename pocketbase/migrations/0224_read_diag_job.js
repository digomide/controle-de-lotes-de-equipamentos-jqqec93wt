migrate(
  (app) => {
    // 1. Carregar token ML
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    const token = sRecords[0].getString('access_token')

    // 2. Investigar como o job j5va5w9d904d6yl (__DIAGNOSTIC_5420__) achou 20 posições!
    const diagJob = app.findFirstRecordByData('ml_catalog_search_jobs', 'id', 'j5va5w9d904d6yl')
    const diagResults = diagJob.get('results') || []

    const col = app.findCollectionByNameOrId('ml_ads_fetch_jobs')
    const rec1 = new Record(col)
    rec1.set('status', 'done')
    rec1.set('status_filter', '__READ_DIAG_JOB__')
    rec1.set('progress_text', 'diag items: ' + diagResults.length)
    rec1.set(
      'error_message',
      JSON.stringify({
        sample: diagResults.slice(0, 5),
        has2097: diagResults.some(
          (r) => r.catalog_product_id === 'MLB2097858038' || r.id === 'MLB2097858038',
        ),
        all_ids: diagResults.map((r) => r.catalog_product_id || r.id),
      }).substring(0, 3990),
    )
    app.save(rec1)
  },
  (app) => {},
)
