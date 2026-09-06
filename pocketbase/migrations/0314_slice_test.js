migrate(
  (app) => {
    const r = app.findFirstRecordByData('ml_catalog_publish_jobs', 'id', 'uc82hebcvxq2og7')
    const raw = r.getString('error_message')

    // Pegar trecho específico após T2
    const idxT3 = raw.indexOf('T3_')
    const idxT5 = raw.indexOf('T5_')
    const t3and4 = raw.substring(idxT3, idxT5)
    const t5and6 = raw.substring(idxT5)

    r.set('error_message', 'T3_T4:\n' + t3and4 + '\n\nT5_T6:\n' + t5and6)
    app.save(r)
  },
  (app) => {},
)
