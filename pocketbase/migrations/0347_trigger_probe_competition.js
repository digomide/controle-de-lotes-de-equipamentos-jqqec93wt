migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('ml_competitor_jobs')
    const job = new Record(col)
    job.set('action', 'resolve_competitor')
    job.set('query', 'PROBE_COMPETITION:MLB5193740831|MLB18732668')
    job.set('status', 'pending')
    app.save(job)
  },
  (app) => {},
)
