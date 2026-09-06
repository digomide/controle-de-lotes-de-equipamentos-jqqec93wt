migrate(
  (app) => {
    const r = app.findFirstRecordByData('ml_catalog_publish_jobs', 'id', 'uc82hebcvxq2og7')
    const raw = r.getString('error_message')
    let obj = {}
    try {
      obj = JSON.parse(raw)
    } catch (_) {}

    const simplified = {}
    for (const k in obj) {
      simplified[k] = {
        status: obj[k].status,
        err: obj[k].error,
        msg: obj[k].message,
        causes: (obj[k].cause || []).map((c) => ({
          code: c.code,
          msg: c.message,
          ref: c.references,
          cause_id: c.cause_id,
        })),
      }
    }

    r.set('error_message', JSON.stringify(simplified).substring(0, 4000))
    app.save(r)
  },
  (app) => {},
)
