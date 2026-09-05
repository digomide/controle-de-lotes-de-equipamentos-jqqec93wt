migrate(
  (app) => {
    // 0243: Injetar p2097 e anúncios próprios na coleção ml_catalog_search_jobs
    // para testar e verificar se a posição é resolvida
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    const token = sRecords.length > 0 ? sRecords[0].getString('access_token') : ''

    const probeRecs = app.findRecordsByFilter(
      'ml_ads_fetch_jobs',
      "status_filter = '__PROBE_0241__'",
      '-created',
      1,
      0,
    )
    const probeData = probeRecs.length > 0 ? probeRecs[0].getString('error_message') : ''

    // Criar um registro em ml_catalog_search_jobs com status='done' para podermos inspecionar via db_describe / error_message
    const col = app.findCollectionByNameOrId('ml_catalog_search_jobs')
    const testJob = new Record(col)
    testJob.set('status', 'done')
    testJob.set('query', '__PROBE_0243_VIEW__')
    testJob.set('progress_text', probeData.substring(0, 100))
    testJob.set('error_message', probeData)
    app.save(testJob)
  },
  (app) => {},
)
