migrate(
  (app) => {
    // 0260: Verificar o resultado gravado em testJob
    const testJob = app.findFirstRecordByData(
      'ml_catalog_search_jobs',
      'query',
      '__PROBE_0243_VIEW__',
    )
    const txt = testJob ? testJob.getString('progress_text') : 'no rec'
    const err = testJob ? testJob.getString('error_message') : 'no err'

    // Limpar jobs de teste
    try {
      app.delete(testJob)
    } catch (_) {}

    // Gravar o resultado no log para confirmar
    console.log('MIGRATION_0260_RESULT: ' + txt + ' | ' + err)
  },
  (app) => {},
)
