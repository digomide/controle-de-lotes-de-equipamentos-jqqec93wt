migrate(
  (app) => {
    const r1 = app.findFirstRecordByData('ml_catalog_publish_jobs', 'id', 'ekv6wnr3kc24msq')
    const resData1 = JSON.stringify(r1.get('result_data'))
    const r2 = app.findFirstRecordByData('ml_catalog_publish_jobs', 'id', 'j8totkrrqbeo9uj')
    const resData2 = JSON.stringify(r2.get('result_data'))

    // Gravamos em r1 e r2 no error_message para inspecionar
    r1.set('error_message', 'DATA1: ' + resData1.substring(0, 500))
    app.save(r1)

    r2.set('error_message', 'DATA2: ' + resData2.substring(0, 500))
    app.save(r2)
  },
  (app) => {},
)
