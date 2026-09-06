migrate(
  (app) => {
    // 0338_unpack_validate_causes.js
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (!sRecords || sRecords.length === 0) return
    const token = sRecords[0].getString('access_token')

    // Pegar o item MLB7566367408 na íntegra
    const itemRes = $http.send({
      url: 'https://api.mercadolibre.com/items/MLB7566367408',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 10,
    })
    const it = itemRes.json || {}

    // Fazer validate com EXATAMENTE o payload derivado de MLB7566367408
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
      shipping: {
        mode: it.shipping?.mode || 'me2',
        local_pick_up: it.shipping?.local_pick_up || false,
        free_shipping: it.shipping?.free_shipping || true,
      },
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

    // E fazer validate no MLB18732668 com o mesmo payload exato trocando só o catalog_product_id
    const p2 = JSON.parse(JSON.stringify(p1))
    p2.catalog_product_id = 'MLB18732668'
    const val1873 = $http.send({
      url: 'https://api.mercadolibre.com/items/validate',
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(p2),
      timeout: 15,
    })

    const filterCauses = (resJson) => {
      if (!resJson || !Array.isArray(resJson.cause)) return resJson
      return resJson.cause.filter((c) => c.type !== 'warning' && !c.code?.includes('lost_me1'))
    }

    const col = app.findCollectionByNameOrId('ml_ads_fetch_jobs')
    const diag = new Record(col)
    diag.set('status', 'done')
    diag.set('status_filter', '__PERICIA_0338__')
    diag.set('progress_text', 'Exact: ' + valExact.statusCode + ' 1873: ' + val1873.statusCode)
    diag.set(
      'error_message',
      JSON.stringify({
        exact_status: valExact.statusCode,
        exact_non_warn: filterCauses(valExact.json),
        pos1873_status: val1873.statusCode,
        pos1873_non_warn: filterCauses(val1873.json),
      }),
    )
    app.save(diag)
  },
  (app) => {},
)
