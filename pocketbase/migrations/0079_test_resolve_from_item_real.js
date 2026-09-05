migrate(
  (app) => {
    // 0079_test_resolve_from_item_real.js
    // Validação end-to-end criando job resolve_from_item com item MLB real de terceiros
    // MLB4709060403 (Notebook Lenovo Thinkpad E16 Gen 2 no ML)
    const jobsCol = app.findCollectionByNameOrId('ml_competitor_jobs')
    const job = new Record(jobsCol)
    job.set('action', 'resolve_from_item')
    job.set('status', 'pending')
    job.set(
      'query',
      'https://produto.mercadolivre.com.br/MLB-4709060403-notebook-lenovo-thinkpad-e16-gen-2-16-touch-com-ryzen-5-_JM',
    )
    job.set('result_data', { item_ids: ['MLB4709060403'] })
    app.save(job)
    console.log('[0079_test_resolve_from_item_real] Job de teste criado: ' + job.id)
  },
  (app) => {},
)
