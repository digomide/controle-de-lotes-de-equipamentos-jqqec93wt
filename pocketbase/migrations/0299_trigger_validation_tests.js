migrate(
  (app) => {
    // Busca 1: dell inspiron 3576 com condition = 'refurbished'
    // Busca 2: dell inspiron 3576 com condition = '' (sem condição)
    // Busca 3: dell latitude 5420 com condition = 'refurbished'
    const col = app.findCollectionByNameOrId('ml_catalog_search_jobs')

    const job1 = new Record(col, {
      query: 'dell inspiron 3576',
      domain_id: '',
      condition: 'refurbished',
      status: 'pending',
      progress_text: 'TESTE_VAL_JOB_1',
      results: [],
    })
    app.save(job1)

    const job2 = new Record(col, {
      query: 'dell inspiron 3576',
      domain_id: '',
      condition: '',
      status: 'pending',
      progress_text: 'TESTE_VAL_JOB_2',
      results: [],
    })
    app.save(job2)

    const job3 = new Record(col, {
      query: 'dell latitude 5420',
      domain_id: '',
      condition: 'refurbished',
      status: 'pending',
      progress_text: 'TESTE_VAL_JOB_3',
      results: [],
    })
    app.save(job3)
  },
  (app) => {},
)
