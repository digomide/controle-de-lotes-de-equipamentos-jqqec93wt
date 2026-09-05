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

    // Pegamos a lista de causes: c.code, c.message, c.references
    try {
      const parsed = JSON.parse(str)
      const causes = (parsed.cause || []).map(function (c) {
        return (
          (c.code || '') +
          ': ' +
          (c.message || '') +
          ' (refs: ' +
          JSON.stringify(c.references) +
          ', type: ' +
          c.type +
          ')'
        )
      })
      r1.set('error_message', 'CAUSES: ' + causes.join(' || '))
    } catch (e) {
      r1.set('error_message', 'JSON ERR: ' + e.message + ' STR: ' + str.substring(0, 200))
    }
    app.save(r1)
  },
  (app) => {},
)
