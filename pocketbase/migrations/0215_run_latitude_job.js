migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('ml_catalog_search_jobs')
    const record = new Record(col)
    record.set('query', 'latitude 5420')
    record.set('domain_id', '')
    record.set('status', 'pending')
    record.set('progress_text', 'Iniciando teste latitude 5420...')
    app.save(record)
  },
  (app) => {},
)
