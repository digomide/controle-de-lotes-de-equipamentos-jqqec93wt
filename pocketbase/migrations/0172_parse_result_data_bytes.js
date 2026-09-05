migrate(
  (app) => {
    const r1 = app.findFirstRecordByData('ml_catalog_publish_jobs', 'id', 'ekv6wnr3kc24msq')
    const rawBytes = r1.get('result_data')
    let str = ''
    if (Array.isArray(rawBytes)) {
      str = String.fromCharCode.apply(null, rawBytes)
    } else if (typeof rawBytes === 'string') {
      str = rawBytes
    } else {
      str = JSON.stringify(rawBytes)
    }

    r1.set('error_message', str.substring(0, 500))
    app.save(r1)

    const r1_part2 = str.substring(500, 1000)
    const r2 = app.findFirstRecordByData('ml_catalog_publish_jobs', 'id', 'j8totkrrqbeo9uj')
    r2.set('error_message', r1_part2)
    app.save(r2)
  },
  (app) => {},
)
