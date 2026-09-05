migrate(
  (app) => {
    const job = app.findFirstRecordByData('ml_catalog_search_jobs', 'id', 'szg3o742i7qawmh')
    job.set('error_message', '')
    app.save(job)
  },
  (app) => {},
)
