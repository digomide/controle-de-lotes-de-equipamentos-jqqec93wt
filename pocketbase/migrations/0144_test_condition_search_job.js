migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('ml_catalog_search_jobs')
    const record = new Record(col)
    record.set('query', 'dell latitude 3420')
    record.set('domain_id', 'MLB-NOTEBOOKS')
    record.set('status', 'pending')
    app.save(record)
  },
  (app) => {
    // rollback
  },
)
