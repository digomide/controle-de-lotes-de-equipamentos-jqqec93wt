migrate(
  (app) => {
    // 0339_check_all_causes.js
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (!sRecords || sRecords.length === 0) return
    const token = sRecords[0].getString('access_token')

    const itemRes = $http.send({
      url: 'https://api.mercadolibre.com/items/MLB7566367408',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 10,
    })
    const it = itemRes.json || {}

    const p1 = {
      catalog_product_id: it.catalog_product_id,
      catalog_listing: true,
      category_id: it.category_id,
      price: it.price,
      currency_id: it.currency_id,
      available_quantity: 1,
      buying_mode: it.buying_mode,
      listing_type_id: it.listing_type_id,
      condition: it.condition,
      sale_terms: it.sale_terms,
      shipping: { mode: 'me2', local_pick_up: true, free_shipping: true },
      attributes: (it.attributes || []).map((a) => ({
        id: a.id,
        value_id: a.value_id,
        value_name: a.value_name,
      })),
    }

    const valExact = $http.send({
      url: 'https://api.mercadolibre.com/items/validate',
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(p1),
      timeout: 15,
    })

    const p2 = JSON.parse(JSON.stringify(p1))
    p2.catalog_product_id = 'MLB18732668'
    const val1873 = $http.send({
      url: 'https://api.mercadolibre.com/items/validate',
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(p2),
      timeout: 15,
    })

    const col = app.findCollectionByNameOrId('ml_ads_fetch_jobs')
    const diag = new Record(col)
    diag.set('status', 'done')
    diag.set('status_filter', '__PERICIA_0339__')
    diag.set(
      'progress_text',
      'Exact causes: ' +
        (valExact.json?.cause?.length || 0) +
        ' 1873 causes: ' +
        (val1873.json?.cause?.length || 0),
    )
    diag.set(
      'error_message',
      JSON.stringify({
        exact_all_causes: valExact.json?.cause,
        exact_message: valExact.json?.message,
        pos1873_all_causes: val1873.json?.cause,
        pos1873_message: val1873.json?.message,
      }).substring(0, 4900),
    )
    app.save(diag)
  },
  (app) => {},
)
