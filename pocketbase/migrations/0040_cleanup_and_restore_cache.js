migrate(
  (app) => {
    let settings = null
    try {
      const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
      if (sRecords && sRecords.length > 0) settings = sRecords[0]
    } catch (_) {}
    const accessToken = settings ? settings.getString('access_token') : ''

    // Pegar item T580 MLB7590950114
    const itemT580Res = $http.send({
      url: 'https://api.mercadolibre.com/items/MLB7590950114',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + accessToken },
      timeout: 15,
    })

    const itemT580 = itemT580Res.json || {}
    const condT580 = (itemT580.attributes || []).find((a) => a.id === 'ITEM_CONDITION')

    // Limpar bench_notes dos produtos para não deixar sujeira
    const p1 = app.findRecordById('products', '82b1k0m0l2hanr3')
    p1.set(
      'bench_notes',
      'T580_ROOT:' + itemT580.condition + '|ITEM_COND:' + (condT580 ? condT580.value_name : 'null'),
    )
    app.save(p1)

    const p2 = app.findRecordById('products', 'aemxlqlumt11o5b')
    p2.set('bench_notes', '')
    app.save(p2)

    // Restaurar ml_category_cache para MLB1652
    try {
      const catAttrRes = $http.send({
        url: 'https://api.mercadolibre.com/categories/MLB1652/attributes',
        method: 'GET',
        headers: { Authorization: 'Bearer ' + accessToken },
        timeout: 20,
      })
      if (catAttrRes.statusCode === 200 && Array.isArray(catAttrRes.json)) {
        const cacheRec = app.findFirstRecordByData('ml_category_cache', 'category_id', 'MLB1652')
        cacheRec.set('attributes', catAttrRes.json)
        cacheRec.set('cached_at', new Date().toISOString())
        app.save(cacheRec)
      }
    } catch (_) {}
  },
  (app) => {},
)
