migrate(
  (app) => {
    let settings = null
    try {
      const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
      if (sRecords && sRecords.length > 0) settings = sRecords[0]
    } catch (_) {}
    const accessToken = settings ? settings.getString('access_token') : ''

    const res1 = $http.send({
      url: 'https://api.mercadolibre.com/items/MLB7590950114',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + accessToken },
      timeout: 15,
    })

    const res2 = $http.send({
      url: 'https://api.mercadolibre.com/items/MLB7591024470',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + accessToken },
      timeout: 15,
    })

    // Buscar categoria atributos completos para condition / refurbished / grading
    const catRes = $http.send({
      url: 'https://api.mercadolibre.com/categories/MLB1652/attributes',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + accessToken },
      timeout: 15,
    })

    let condAttrs = []
    if (catRes.statusCode === 200 && Array.isArray(catRes.json)) {
      condAttrs = catRes.json
        .filter((a) => {
          const id = (a.id || '').toLowerCase()
          const n = (a.name || '').toLowerCase()
          return (
            id.includes('cond') ||
            id.includes('grad') ||
            id.includes('refurb') ||
            id.includes('packag') ||
            n.includes('condi') ||
            n.includes('recond') ||
            n.includes('estado') ||
            n.includes('grau')
          )
        })
        .map((a) => ({
          id: a.id,
          name: a.name,
          tags: a.tags,
          hierarchy: a.hierarchy,
          values: (a.values || []).map((v) => ({ id: v.id, name: v.name })),
        }))
    }

    const p1 = res1.statusCode === 200 ? res1.json : { err: res1.statusCode }
    const p2 = res2.statusCode === 200 ? res2.json : { err: res2.statusCode }

    // Salvamos em um novo registro ou formato simples em ml_settings ou produto
    const pRecord = app.findRecordById('products', '82b1k0m0l2hanr3')
    pRecord.set(
      'bench_notes',
      JSON.stringify({
        condAttrs: condAttrs,
        item1: {
          id: p1.id,
          cond: p1.condition,
          user_product_id: p1.user_product_id,
          catalog_product_id: p1.catalog_product_id,
          variations: p1.variations,
          attrs: (p1.attributes || []).map((a) => ({
            id: a.id,
            val_id: a.value_id,
            val_name: a.value_name,
          })),
        },
        item2: {
          id: p2.id,
          cond: p2.condition,
          user_product_id: p2.user_product_id,
          catalog_product_id: p2.catalog_product_id,
          variations: p2.variations,
          attrs: (p2.attributes || []).map((a) => ({
            id: a.id,
            val_id: a.value_id,
            val_name: a.value_name,
          })),
        },
      }).slice(0, 4000),
    )
    app.save(pRecord)
  },
  (app) => {},
)
