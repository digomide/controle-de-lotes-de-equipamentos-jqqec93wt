migrate(
  (app) => {
    let settings = null
    try {
      const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
      if (sRecords && sRecords.length > 0) settings = sRecords[0]
    } catch (_) {}
    const accessToken = settings ? settings.getString('access_token') : ''

    // Pegar user_product do Dell MLBU5082535419
    const upRes = $http.send({
      url: 'https://api.mercadolibre.com/user-products/MLBU5082535419',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + accessToken },
      timeout: 15,
    })

    const p2 = app.findRecordById('products', 'aemxlqlumt11o5b')
    const up = upRes.json || {}
    p2.set(
      'bench_notes',
      JSON.stringify({
        up_id: up.id,
        name: up.name,
        status: up.status,
        variations: up.variations,
        attributes: (up.attributes || []).map((a) => ({
          id: a.id,
          value_id: a.value_id,
          value_name: a.value_name,
        })),
      }).slice(0, 3000),
    )
    app.save(p2)
  },
  (app) => {},
)
