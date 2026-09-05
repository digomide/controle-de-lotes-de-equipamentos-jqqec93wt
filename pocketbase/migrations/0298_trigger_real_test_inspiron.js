migrate(
  (app) => {
    // Criar job de busca por "dell inspiron 3576" com condição "refurbished"
    const col = app.findCollectionByNameOrId('ml_catalog_search_jobs')
    const jobRec = new Record(col, {
      query: 'dell inspiron 3576',
      domain_id: '',
      condition: 'refurbished',
      status: 'pending',
      progress_text: 'Criando busca real teste Inspiron 3576...',
      results: [],
    })
    app.save(jobRec)
  },
  (app) => {},
)
