migrate(
  (app) => {
    const r = app.findFirstRecordByData('ml_catalog_publish_jobs', 'id', 'uc82hebcvxq2og7')
    const raw = r.getString('error_message')
    let obj = {}
    try {
      obj = JSON.parse(raw)
    } catch (_) {}

    // Exibir cada teste individualmente
    let lines = []
    for (const k in obj) {
      const c = obj[k].causes || []
      const cStr = c.map((x) => x.code + ': ' + x.msg).join(' ; ')
      lines.push(
        k + ' => status:' + obj[k].status + ' err:' + (obj[k].err || '') + ' causes:' + cStr,
      )
    }

    r.set('error_message', lines.join(' \n\n '))
    app.save(r)
  },
  (app) => {},
)
