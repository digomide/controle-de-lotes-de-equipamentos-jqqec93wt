migrate(
  (app) => {
    // 0256: Copiar de testJob para um campo legível
    const testJob = app.findFirstRecordByData(
      'ml_catalog_search_jobs',
      'query',
      '__PROBE_0243_VIEW__',
    )
    if (testJob) {
      testJob.set('progress_text', testJob.getString('error_message').substring(0, 200))
      app.save(testJob)
    }
  },
  (app) => {},
)
