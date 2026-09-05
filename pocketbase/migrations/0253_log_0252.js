migrate(
  (app) => {
    // 0253: Verificar o resultado gravado em __PROBE_0243_VIEW__
    const rec = app.findFirstRecordByData('ml_catalog_search_jobs', 'query', '__PROBE_0243_VIEW__')
    if (rec) {
      console.log('0252_STATUS: ' + rec.getString('progress_text'))
    }
  },
  (app) => {},
)
