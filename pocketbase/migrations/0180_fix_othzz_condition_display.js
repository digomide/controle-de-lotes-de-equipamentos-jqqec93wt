migrate(
  (app) => {
    const r3 = app.findFirstRecordByData('ml_catalog_publish_jobs', 'id', 'othzzc6aoygqnsr')
    r3.set('condition', 'new')
    app.save(r3)
  },
  (app) => {},
)
