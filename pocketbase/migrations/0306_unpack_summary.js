migrate(
  (app) => {
    const r = app.findFirstRecordByData('ml_catalog_publish_jobs', 'id', 'uc82hebcvxq2og7')
    const raw = r.getString('result_data')
    // Parse json
    let obj = {}
    try {
      obj = JSON.parse(raw)
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

    const summary = {
      prodName: obj.prodData?.name,
      prodCond: obj.prodData?.condition,
      valA_status: obj.validateA?.status,
      valA_err: obj.validateA?.json?.cause || obj.validateA?.json?.message,
      valB_status: obj.validateB?.status,
      valB_err: obj.validateB?.json?.cause || obj.validateB?.json?.message,
      itemCondValues: ic ? ic.values : 'NOT_FOUND',
    }

    r.set('error_message', JSON.stringify(summary))
    app.save(r)
  },
  (app) => {},
)
