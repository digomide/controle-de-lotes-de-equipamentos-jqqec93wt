migrate(
  (app) => {
    // 0520_diagnose_variations_put.js
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
    const vars = item.variations || []

    let varTestRes = 'no_vars'
    if (vars.length > 0) {
      const v0 = vars[0]
      // Tenta atualizar variação diretamente
      const r = $http.send({
        url: 'https://api.mercadolibre.com/items/MLB5195337721/variations/' + v0.id,
        method: 'PUT',
        headers: {
          Authorization: 'Bearer ' + accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ price: 3500 }),
        timeout: 15,
      })
      varTestRes = 'VAR_PUT_ST=' + r.statusCode + ' VAR_PUT_RAW=' + r.raw
    }

    const col = app.findCollectionByNameOrId('ml_item_queue')
    const q = new Record(col)
    q.set('action', 'update_price')
    q.set('ml_item_id', 'MLB5195337721')
    q.set('new_price', 3500)
    q.set('status', 'error')
    q.set('error_message', varTestRes.substring(0, 500))
    app.save(q)
  },
  (app) => {},
)
