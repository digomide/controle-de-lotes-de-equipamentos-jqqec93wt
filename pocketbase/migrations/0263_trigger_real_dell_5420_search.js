migrate(
  (app) => {
    // 0263: Disparar um job real de ml_catalog_search_jobs com "dell latitude 5420" e condition="refurbished"
    const col = app.findCollectionByNameOrId('ml_catalog_search_jobs')
    const job = new Record(col)
    job.set('query', 'dell latitude 5420')
    job.set('condition', 'refurbished')
    job.set('status', 'pending')
    app.save(job)
    console.log('[MIGRATION_0263] Job criado com id: ' + job.id)
  },
  (app) => {},
)
