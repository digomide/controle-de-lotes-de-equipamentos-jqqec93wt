migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('ml_ads_fetch_jobs')
    const job = new Record(collection)
    job.set('status', 'pending')
    job.set('progress_text', 'Iniciando...')
    job.set('limit', 50)
    job.set('offset', 0)
    app.save(job)
  },
  (app) => {
    // no-op down
  },
)
