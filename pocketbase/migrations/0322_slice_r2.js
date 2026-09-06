migrate(
  (app) => {
    const r = app.findFirstRecordByData('ml_catalog_publish_jobs', 'id', 'lo0rtbzlgq6a5el')
    const raw = r.getString('error_message') || ''

    // Escrever resumo no r2
    const r2 = app.findFirstRecordByData('ml_catalog_publish_jobs', 'id', 'xq9ap5apv0jjgcm')
    r2.set('error_message', raw.substring(0, 300))
    app.save(r2)
  },
  (app) => {},
)
