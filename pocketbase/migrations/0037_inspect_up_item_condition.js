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
    const itemCond = (up.attributes || []).find((a) => a.id === 'ITEM_CONDITION')
    const grading = (up.attributes || []).find((a) => a.id === 'GRADING')
    const variations = up.variations || []

    p2.set(
      'bench_notes',
      JSON.stringify({
        item_condition_attr: itemCond,
        grading_attr: grading,
        variations: variations,
      }),
    )
    app.save(p2)
  },
  (app) => {},
)
