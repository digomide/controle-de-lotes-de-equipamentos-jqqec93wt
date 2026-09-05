migrate(
  (app) => {
    const r3 = app.findFirstRecordByData('ml_catalog_publish_jobs', 'id', 'othzzc6aoygqnsr')
    const d = r3.get('result_data')
    // Converter bytes ou json para ver catalog_product_id e outros campos
    let str = ''
    if (Array.isArray(d)) {
      str = String.fromCharCode.apply(null, d)
    } else {
      str = JSON.stringify(d)
    }
    const parsed = JSON.parse(str)

    const r2 = app.findFirstRecordByData('ml_catalog_publish_jobs', 'id', 'j8totkrrqbeo9uj')
    r2.set(
      'error_message',
      'OTH_PROD_ID: ' +
        parsed.catalog_product_id +
        ' COND: ' +
        parsed.condition +
        ' CAT: ' +
        parsed.category_id,
    )
    app.save(r2)
  },
  (app) => {},
)
