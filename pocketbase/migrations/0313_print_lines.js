migrate(
  (app) => {
    const r = app.findFirstRecordByData('ml_catalog_publish_jobs', 'id', 'uc82hebcvxq2og7')
    const raw = r.getString('error_message')

    // Split por ---T e mostrar cada um
    const items = raw.split('---T')
    let out = []
    for (let i = 0; i < items.length; i++) {
      out.push('T' + items[i].trim())
    }
    r.set('error_message', out.join('\n\n'))
    app.save(r)
  },
  (app) => {},
)
