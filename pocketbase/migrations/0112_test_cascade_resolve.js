migrate(
  (app) => {
    // 0112_test_cascade_resolve.js
    const col = app.findCollectionByNameOrId('ml_competitor_jobs')
    const job = new Record(col)
    job.set('action', 'resolve_from_item')
    job.set('status', 'pending')
    job.set(
      'query',
      'https://www.mercadolivre.com.br/dell-g7-15-i7-1135g7-16gb-256-m2-cor-preto-excelente-recondicionado/p/MLB2010941196#polycard_client=search-desktop&wid=MLB4836138319',
    )
    job.set('result_data', {
      item_ids: [
        'https://www.mercadolivre.com.br/dell-g7-15-i7-1135g7-16gb-256-m2-cor-preto-excelente-recondicionado/p/MLB2010941196',
        'MLB4836138319',
      ],
    })
    app.save(job)
  },
  (app) => {},
)
