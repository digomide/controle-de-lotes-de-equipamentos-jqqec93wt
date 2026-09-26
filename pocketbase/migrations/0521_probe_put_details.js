migrate(
  (app) => {
    // 0521_probe_put_details.js
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

    const itemRes = $http.send({
      url: 'https://api.mercadolibre.com/items/MLB5195337721',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + accessToken },
      timeout: 15,
    })
    const item = itemRes.json || {}

    // Teste A: PUT status: 'paused' ou status: item.status
    const rStatus = $http.send({
      url: 'https://api.mercadolibre.com/items/MLB5195337721',
      method: 'PUT',
      headers: {
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ available_quantity: item.available_quantity }),
      timeout: 15,
    })

    // Teste B: PUT /items/MLB5195337721 com variations array completo
    let rVarsArray = { statusCode: 0, raw: 'no_vars' }
    if (item.variations && item.variations.length > 0) {
      rVarsArray = $http.send({
        url: 'https://api.mercadolibre.com/items/MLB5195337721',
        method: 'PUT',
        headers: {
          Authorization: 'Bearer ' + accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          variations: item.variations.map((v) => ({ id: v.id, price: 3500 })),
        }),
        timeout: 15,
      })
    }

    const col = app.findCollectionByNameOrId('ml_item_queue')
    const q = new Record(col)
    q.set('action', 'update_price')
    q.set('ml_item_id', 'MLB5195337721')
    q.set('new_price', 3500)
    q.set('status', 'error')
    q.set(
      'error_message',
      (
        'QTY_ST=' +
        rStatus.statusCode +
        ' QTY_RAW=' +
        rStatus.raw +
        ' | VARS_ST=' +
        rVarsArray.statusCode +
        ' VARS_RAW=' +
        rVarsArray.raw
      ).substring(0, 500),
    )
    app.save(q)
  },
  (app) => {},
)
