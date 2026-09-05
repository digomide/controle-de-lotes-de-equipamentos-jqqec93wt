migrate(
  (app) => {
    // 0068: Teste para acionar busca real de anúncios via ml_ads_fetch_jobs
    // e verificar se o hook onRecordAfterCreateSuccess executa e popula os anúncios do ML
    const col = app.findCollectionByNameOrId('ml_ads_fetch_jobs')
    const job = new Record(col)
    job.set('limit', 10)
    job.set('offset', 0)
    job.set('status', 'pending')
    app.save(job)
  },
  (app) => {},
)
