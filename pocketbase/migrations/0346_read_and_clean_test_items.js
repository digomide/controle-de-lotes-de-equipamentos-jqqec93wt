migrate(
  (app) => {
    // 0346: Limpeza de registros de diagnóstico criados durante a perícia forense
    try {
      const diagJobs = app.findRecordsByFilter(
        'ml_ads_fetch_jobs',
        "status_filter ~ '__PERICIA_'",
        '-created',
        100,
        0,
      )
      for (let i = 0; i < diagJobs.length; i++) {
        app.delete(diagJobs[i])
      }
    } catch (_) {}

    try {
      const testPubJobs = app.findRecordsByFilter(
        'ml_catalog_publish_jobs',
        'price = 9999',
        '-created',
        10,
        0,
      )
      for (let j = 0; j < testPubJobs.length; j++) {
        app.delete(testPubJobs[j])
      }
    } catch (_) {}
  },
  (app) => {},
)
