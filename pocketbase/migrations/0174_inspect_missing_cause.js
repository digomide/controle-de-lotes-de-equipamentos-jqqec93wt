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

    try {
      const parsed = JSON.parse(str)
      const missingCause = (parsed.cause || []).find(
        (c) => (c.code || '').indexOf('missing') >= 0 || (c.message || '').indexOf('Missing') >= 0,
      )
      r1.set('error_message', 'MISSING_CAUSE: ' + JSON.stringify(missingCause))
    } catch (e) {
      r1.set('error_message', 'ERR: ' + e.message)
    }
    app.save(r1)
  },
  (app) => {},
)
