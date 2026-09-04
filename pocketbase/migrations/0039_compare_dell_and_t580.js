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

    // Pegar item T580 MLB7590950114
    const itemT580Res = $http.send({
      url: 'https://api.mercadolibre.com/items/MLB7590950114',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + accessToken },
      timeout: 15,
    })

    const p1 = app.findRecordById('products', '82b1k0m0l2hanr3')
    const itemDell = itemRes.json || {}
    const itemT580 = itemT580Res.json || {}

    const condDell = (itemDell.attributes || []).find((a) => a.id === 'ITEM_CONDITION')
    const gradingDell = (itemDell.attributes || []).find((a) => a.id === 'GRADING')

    const condT580 = (itemT580.attributes || []).find((a) => a.id === 'ITEM_CONDITION')
    const gradingT580 = (itemT580.attributes || []).find((a) => a.id === 'GRADING')

    p1.set(
      'bench_notes',
      JSON.stringify({
        dell: {
          root_condition: itemDell.condition,
          ITEM_CONDITION: condDell,
          GRADING: gradingDell,
          variations_len: (itemDell.variations || []).length,
        },
        t580: {
          root_condition: itemT580.condition,
          ITEM_CONDITION: condT580,
          GRADING: gradingT580,
          variations_len: (itemT580.variations || []).length,
        },
      }),
    )
    app.save(p1)
  },
  (app) => {},
)
