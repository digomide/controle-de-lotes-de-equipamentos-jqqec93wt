migrate(
  (app) => {
    const r = app.findFirstRecordByData('ml_catalog_publish_jobs', 'id', 'lo0rtbzlgq6a5el')
    const raw = r.getString('error_message') || ''

    // Ver o início exato
    const r2 = app.findFirstRecordByData('ml_catalog_publish_jobs', 'id', 'xq9ap5apv0jjgcm')
    r2.set('error_message', raw.substring(0, 150))
    app.save(r2)
  },
  (app) => {},
)
