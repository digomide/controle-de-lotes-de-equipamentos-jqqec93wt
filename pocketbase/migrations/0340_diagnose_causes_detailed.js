migrate(
  (app) => {
    // 0340_diagnose_causes_detailed.js
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (!sRecords || sRecords.length === 0) return
    const token = sRecords[0].getString('access_token')

    // Testar com payload limpo:
    // A: MLB2097858038 com condition "new" + ITEM_CONDITION 2230582 + GRADING 40108830
    const pA = {
      catalog_product_id: 'MLB2097858038',
      catalog_listing: true,
      category_id: 'MLB1652',
      price: 3500,
      currency_id: 'BRL',
      available_quantity: 1,
      buying_mode: 'buy_it_now',
      listing_type_id: 'gold_special',
      condition: 'new',
      sale_terms: [
        { id: 'WARRANTY_TYPE', value_name: 'Garantia do vendedor' },
        { id: 'WARRANTY_TIME', value_name: '90 dias' },
      ],
      shipping: { mode: 'me2', local_pick_up: true, free_shipping: true },
      attributes: [
        { id: 'ITEM_CONDITION', value_id: '2230582' },
        { id: 'GRADING', value_id: '40108830' },
      ],
    }
    const resA = $http.send({
      url: 'https://api.mercadolibre.com/items/validate',
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(pA),
      timeout: 15,
    })

    // B: MLB18732668 com condition "new" + ITEM_CONDITION 2230582 + GRADING 40108830
    const pB = JSON.parse(JSON.stringify(pA))
    pB.catalog_product_id = 'MLB18732668'
    const resB = $http.send({
      url: 'https://api.mercadolibre.com/items/validate',
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(pB),
      timeout: 15,
    })

    // C: MLB18732668 com o formato antigo (sem condition raiz, apenas ITEM_CONDITION 2230582)
    const pC = {
      catalog_product_id: 'MLB18732668',
      catalog_listing: true,
      category_id: 'MLB1652',
      price: 3500,
      currency_id: 'BRL',
      available_quantity: 1,
      buying_mode: 'buy_it_now',
      listing_type_id: 'gold_special',
      sale_terms: [
        { id: 'WARRANTY_TYPE', value_name: 'Garantia do vendedor' },
        { id: 'WARRANTY_TIME', value_name: '90 dias' },
      ],
      shipping: { mode: 'me2', local_pick_up: true, free_shipping: true },
      attributes: [{ id: 'ITEM_CONDITION', value_id: '2230582' }],
    }
    const resC = $http.send({
      url: 'https://api.mercadolibre.com/items/validate',
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(pC),
      timeout: 15,
    })

    const formatCauses = (json) => {
      if (!json || !Array.isArray(json.cause)) return json
      return json.cause.map(
        (c) =>
          (c.type || 'error') +
          ': ' +
          (c.code || '') +
          ' - ' +
          (c.message || '') +
          ' (' +
          (c.references || []).join(',') +
          ')',
      )
    }

    const col = app.findCollectionByNameOrId('ml_ads_fetch_jobs')
    const diag = new Record(col)
    diag.set('status', 'done')
    diag.set('status_filter', '__PERICIA_0340__')
    diag.set(
      'progress_text',
      'resA: ' + resA.statusCode + ' resB: ' + resB.statusCode + ' resC: ' + resC.statusCode,
    )
    diag.set(
      'error_message',
      JSON.stringify({
        resA: { status: resA.statusCode, causes: formatCauses(resA.json) },
        resB: { status: resB.statusCode, causes: formatCauses(resB.json) },
        resC: { status: resC.statusCode, causes: formatCauses(resC.json) },
      }).substring(0, 4900),
    )
    app.save(diag)
  },
  (app) => {},
)
