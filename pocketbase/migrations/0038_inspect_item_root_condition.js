migrate(
  (app) => {
    let settings = null
    try {
      const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
      if (sRecords && sRecords.length > 0) settings = sRecords[0]
    } catch (_) {}
    const accessToken = settings ? settings.getString('access_token') : ''

    // Pegar item Dell MLB7591024470
    const itemRes = $http.send({
      url: 'https://api.mercadolibre.com/items/MLB7591024470',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + accessToken },
      timeout: 15,
    })

    const p1 = app.findRecordById('products', '82b1k0m0l2hanr3')
    const item = itemRes.json || {}
    const itemCond = (item.attributes || []).find((a) => a.id === 'ITEM_CONDITION')
    const grading = (item.attributes || []).find((a) => a.id === 'GRADING')

    p1.set(
      'bench_notes',
      JSON.stringify({
        root_condition: item.condition,
        item_condition_attr: itemCond,
        grading_attr: grading,
        sub_status: item.sub_status,
        tags: item.tags,
      }),
    )
    app.save(p1)
  },
  (app) => {},
)
