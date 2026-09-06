migrate(
  (app) => {
    const r = app.findFirstRecordByData('ml_catalog_publish_jobs', 'id', 'uc82hebcvxq2og7')
    let obj = {}
    try {
      obj = JSON.parse(r.getString('result_data'))
    } catch (_) {
      obj = r.get('result_data') || {}
    }

    // Mostrar o que aconteceu no valB (quando enviou condition: 'used' + attributes ITEM_CONDITION Recondicionado)
    r.set(
      'error_message',
      'VAL_B: status ' +
        obj.validateB?.status +
        ' | ' +
        JSON.stringify(obj.validateB?.json).substring(0, 500),
    )
    app.save(r)
  },
  (app) => {},
)
