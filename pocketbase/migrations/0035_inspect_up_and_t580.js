migrate(
  (app) => {
    let settings = null
    try {
      const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
      if (sRecords && sRecords.length > 0) settings = sRecords[0]
    } catch (_) {}
    const accessToken = settings ? settings.getString('access_token') : ''

    // Pegar item T580
    const t580Res = $http.send({
      url: 'https://api.mercadolibre.com/items/MLB7590950114',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + accessToken },
      timeout: 15,
    })

    // Pegar user_product do Dell MLBU5082535419
    const upRes = $http.send({
      url: 'https://api.mercadolibre.com/user-products/MLBU5082535419',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + accessToken },
      timeout: 15,
    })

    const p1 = app.findRecordById('products', '82b1k0m0l2hanr3')
    const t580 = t580Res.statusCode === 200 ? t580Res.json : {}
    p1.set(
      'bench_notes',
      JSON.stringify({
        condition: t580.condition,
        user_product_id: t580.user_product_id,
        variations_len: (t580.variations || []).length,
        variations: t580.variations,
        grading: (t580.attributes || []).filter(
          (a) => a.id === 'GRADING' || a.id === 'ITEM_GRADE' || a.id === 'ITEM_CONDITION',
        ),
      }).slice(0, 3000),
    )
    app.save(p1)

    const p2 = app.findRecordById('products', 'aemxlqlumt11o5b')
    p2.set('bench_notes', JSON.stringify(upRes.json || {}).slice(0, 3000))
    app.save(p2)
  },
  (app) => {},
)
