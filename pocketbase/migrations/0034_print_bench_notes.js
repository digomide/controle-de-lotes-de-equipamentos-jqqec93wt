migrate(
  (app) => {
    const pRecord = app.findRecordById('products', '82b1k0m0l2hanr3')
    const str = pRecord.getString('bench_notes') || ''
    pRecord.set('bench_notes', '')
    app.save(pRecord)

    // Consultar atributos de categoria diretamente
    let settings = null
    try {
      const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
      if (sRecords && sRecords.length > 0) settings = sRecords[0]
    } catch (_) {}
    const accessToken = settings ? settings.getString('access_token') : ''

    const catRes = $http.send({
      url: 'https://api.mercadolibre.com/categories/MLB1652/attributes',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + accessToken },
      timeout: 15,
    })

    let relevantAttrs = []
    if (catRes.statusCode === 200 && Array.isArray(catRes.json)) {
      for (let i = 0; i < catRes.json.length; i++) {
        const a = catRes.json[i]
        const aid = (a.id || '').toUpperCase()
        const aname = (a.name || '').toLowerCase()
        if (
          aid.includes('COND') ||
          aid.includes('GRAD') ||
          aid.includes('REFURB') ||
          aname.includes('condi') ||
          aname.includes('recond') ||
          aname.includes('grau')
        ) {
          relevantAttrs.push({
            id: a.id,
            name: a.name,
            tags: a.tags,
            hierarchy: a.hierarchy,
            values: (a.values || []).map((v) => ({ id: v.id, name: v.name })),
          })
        }
      }
    }

    pRecord.set('bench_notes', JSON.stringify(relevantAttrs).slice(0, 3000))
    app.save(pRecord)

    // Inspecionar o item T580
    const itemRes = $http.send({
      url: 'https://api.mercadolibre.com/items/MLB7590950114',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + accessToken },
      timeout: 15,
    })

    const p2 = app.findRecordById('products', 'aemxlqlumt11o5b')
    if (itemRes.statusCode === 200) {
      const d = itemRes.json
      p2.set(
        'bench_notes',
        JSON.stringify({
          condition: d.condition,
          user_product_id: d.user_product_id,
          variations: d.variations,
          grading: (d.attributes || []).filter(
            (a) => a.id === 'GRADING' || a.id === 'ITEM_GRADE' || a.id === 'ITEM_CONDITION',
          ),
        }).slice(0, 3000),
      )
    } else {
      p2.set('bench_notes', 'ERR: ' + itemRes.statusCode)
    }
    app.save(p2)
  },
  (app) => {},
)
