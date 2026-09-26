migrate(
  (app) => {
    // 0512_test_and_dump_to_error_msg.js
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
    const sellerId = settings.getString('user_id_ml')

    // Teste 1: GET /items/MLB5195337721
    const g = $http.send({
      url: 'https://api.mercadolibre.com/items/MLB5195337721',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + accessToken },
      timeout: 15,
    })

    // Teste 2: PUT /items/MLB5195337721 { price: 3500 }
    const p = $http.send({
      url: 'https://api.mercadolibre.com/items/MLB5195337721',
      method: 'PUT',
      headers: {
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ price: 3500 }),
      timeout: 15,
    })

    const gJson = g.json || {}
    const pJson = p.json || {}

    const col = app.findCollectionByNameOrId('ml_competitor_jobs')
    const rec = new Record(col)
    rec.set('action', 'search_query')
    rec.set('status', 'done')
    rec.set('query', 'dump_mlb5195337721')
    rec.set(
      'error_message',
      (
        'G_SELLER=' +
        gJson.seller_id +
        ' G_STATUS=' +
        g.statusCode +
        ' P_STATUS=' +
        p.statusCode +
        ' P_RAW=' +
        p.raw
      ).substring(0, 800),
    )
    app.save(rec)
  },
  (app) => {},
)
