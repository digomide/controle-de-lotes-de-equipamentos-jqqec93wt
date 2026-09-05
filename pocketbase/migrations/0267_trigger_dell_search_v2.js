migrate(
  (app) => {
    // 0267: Disparar novo job real de ml_catalog_search_jobs com getString corrigido
    const col = app.findCollectionByNameOrId('ml_catalog_search_jobs')
    const job = new Record(col)
    job.set('query', 'dell latitude 5420')
    job.set('condition', 'refurbished')
    job.set('status', 'pending')
    app.save(job)
    console.log('[MIGRATION_0267] Job criado com id: ' + job.id)
  },
  (app) => {},
)
