migrate(
  (app) => {
    const r = app.findFirstRecordByData('ml_catalog_publish_jobs', 'id', 'uc82hebcvxq2og7')
    const raw = r.getString('error_message')

    // Pegar T2, T3, T4, T5, T6
    const parts = raw.split(' T')
    r.set('error_message', parts.slice(1).join(' \n---T').substring(0, 3000))
    app.save(r)
  },
  (app) => {},
)
