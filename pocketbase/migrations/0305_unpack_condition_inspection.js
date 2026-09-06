migrate(
  (app) => {
    const r = app.findFirstRecordByData('ml_catalog_publish_jobs', 'id', 'uc82hebcvxq2og7')
    const data = r.get('result_data')

    // Extrair os valores exatos de ITEM_CONDITION
    const itemCondAttr = (data.categoryAttrs || []).find((a) => a.id === 'ITEM_CONDITION')

    r.set(
      'error_message',
      JSON.stringify({
        prodData: data.prodData,
        itemCondValues: itemCondAttr ? itemCondAttr.values : [],
        validateA: data.validateA,
        validateB: data.validateB,
      }).substring(0, 4000),
    )
    app.save(r)
  },
  (app) => {},
)
