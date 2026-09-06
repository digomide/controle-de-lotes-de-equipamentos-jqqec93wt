migrate(
  (app) => {
    const r = app.findFirstRecordByData('ml_catalog_publish_jobs', 'id', 'uc82hebcvxq2og7')
    let obj = {}
    try {
      obj = JSON.parse(r.getString('result_data'))
    } catch (_) {
      obj = r.get('result_data') || {}
    }

    const catAttrs = obj.categoryAttrs || []
    let ic = null
    for (let i = 0; i < catAttrs.length; i++) {
      if (catAttrs[i].id === 'ITEM_CONDITION') {
        ic = catAttrs[i]
        break
      }
    }

    // Apenas os values de ITEM_CONDITION
    r.set('error_message', 'VALS: ' + JSON.stringify(ic ? ic.values : []))
    app.save(r)
  },
  (app) => {},
)
