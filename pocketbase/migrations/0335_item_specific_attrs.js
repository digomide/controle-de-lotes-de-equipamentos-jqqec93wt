migrate(
  (app) => {
    // 0335_item_specific_attrs.js
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (!sRecords || sRecords.length === 0) return
    const token = sRecords[0].getString('access_token')

    const itemRes = $http.send({
      url: 'https://api.mercadolibre.com/items/MLB7566367408',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 10,
    })

    const it = itemRes.json || {}
    const filteredAttrs = (it.attributes || []).filter((a) => {
      const id = (a.id || '').toUpperCase()
      const n = (a.name || '').toLowerCase()
      const v = (a.value_name || '').toLowerCase()
      return (
        id.includes('COND') ||
        id.includes('GRAD') ||
        id.includes('REFURB') ||
        id.includes('STATUS') ||
        n.includes('cond') ||
        n.includes('recond') ||
        v.includes('recond') ||
        v.includes('excelente')
      )
    })

    // Checar também o produto MLB2097858038
    const prodRes = $http.send({
      url: 'https://api.mercadolibre.com/products/MLB2097858038',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 10,
    })
    const pr = prodRes.json || {}
    const prFilteredAttrs = (pr.attributes || []).filter((a) => {
      const id = (a.id || '').toUpperCase()
      const n = (a.name || '').toLowerCase()
      const v = (a.value_name || '').toLowerCase()
      return (
        id.includes('COND') ||
        id.includes('GRAD') ||
        id.includes('REFURB') ||
        id.includes('STATUS') ||
        n.includes('cond') ||
        n.includes('recond') ||
        v.includes('recond') ||
        v.includes('excelente')
      )
    })

    // Checar MLB18732668 (a posição onde tentamos publicar) e se tem relação familiar com MLB2097858038
    const prod1873 =
      $http.send({
        url: 'https://api.mercadolibre.com/products/MLB18732668',
        method: 'GET',
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
        timeout: 10,
      }).json || {}

    const col = app.findCollectionByNameOrId('ml_ads_fetch_jobs')
    const diag = new Record(col)
    diag.set('status', 'done')
    diag.set('status_filter', '__PERICIA_0335__')
    diag.set(
      'progress_text',
      'prod parent: ' + pr.parent_id + ' prod1873 parent: ' + prod1873.parent_id,
    )
    diag.set(
      'error_message',
      JSON.stringify({
        item_condition_attrs: filteredAttrs,
        prod_2097: {
          id: pr.id,
          name: pr.name,
          parent_id: pr.parent_id,
          children_ids: pr.children_ids,
          attrs: prFilteredAttrs,
        },
        prod_1873: {
          id: prod1873.id,
          name: prod1873.name,
          parent_id: prod1873.parent_id,
          children_ids: prod1873.children_ids,
        },
      }).substring(0, 4900),
    )
    app.save(diag)
  },
  (app) => {},
)
