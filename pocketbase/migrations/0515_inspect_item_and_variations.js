migrate(
  (app) => {
    // 0515_inspect_item_and_variations.js
    let settings = null
    try {
      const sRecords = app.findRecordsByFilter(
        'ml_settings',
        'tenant_id = "ambicorpmestre1"',
        '-created',
        1,
        0,
      )
      if (sRecords && sRecords.length > 0) settings = sRecords[0]
    } catch (_) {}
    if (!settings) return
    const accessToken = settings.getString('access_token')

    const g = $http.send({
      url: 'https://api.mercadolibre.com/items/MLB5195337721',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + accessToken },
      timeout: 15,
    })
    const body = g.json || {}

    // Teste 1: Se tiver variações, tentar atualizar o preço da variação
    let varPutResult = 'no_variations'
    if (body.variations && body.variations.length > 0) {
      const v0 = body.variations[0]
      const putVar = $http.send({
        url: 'https://api.mercadolibre.com/items/MLB5195337721/variations/' + v0.id,
        method: 'PUT',
        headers: {
          Authorization: 'Bearer ' + accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ price: 3500 }),
        timeout: 15,
      })
      varPutResult = 'status=' + putVar.statusCode + ' raw=' + putVar.raw
    }

    // Teste 2: Tentar PUT /items/MLB5195337721 com variations array
    let itemVarsPutResult = 'none'
    if (body.variations && body.variations.length > 0) {
      const updatedVars = body.variations.map((v) => ({ id: v.id, price: 3500 }))
      const putItemVars = $http.send({
        url: 'https://api.mercadolibre.com/items/MLB5195337721',
        method: 'PUT',
        headers: {
          Authorization: 'Bearer ' + accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ variations: updatedVars }),
        timeout: 15,
      })
      itemVarsPutResult = 'status=' + putItemVars.statusCode + ' raw=' + putItemVars.raw
    }

    // Teste 3: Tentar endpoint /items/MLB5195337721/prices ou algo correlato se existir
    const pPrices = $http.send({
      url: 'https://api.mercadolibre.com/items/MLB5195337721/prices',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + accessToken },
      timeout: 10,
    })

    const col = app.findCollectionByNameOrId('ml_competitor_jobs')
    const rec = new Record(col)
    rec.set('action', 'search_query')
    rec.set('status', 'done')
    rec.set('query', 'inspect_vars_price')
    rec.set(
      'error_message',
      JSON.stringify({
        title: body.title,
        catalog_listing: body.catalog_listing,
        catalog_product_id: body.catalog_product_id,
        channels: body.channels,
        tags: body.tags,
        variations: (body.variations || []).map((v) => ({ id: v.id, price: v.price })),
        test1_varPut: varPutResult,
        test2_itemVarsPut: itemVarsPutResult,
        test3_pricesGet: 'status=' + pPrices.statusCode + ' raw=' + pPrices.raw,
      }).substring(0, 1000),
    )
    app.save(rec)
  },
  (app) => {},
)
