migrate(
  (app) => {
    // 0332_pericia_anuncio_recondicionado.js
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (!sRecords || sRecords.length === 0) return
    const token = sRecords[0].getString('access_token')
    const sellerId = sRecords[0].getString('user_id_ml') || '626774396'

    // 1. Buscar anúncios recentes do vendedor no ML com termo 5420 ou latitude
    const searchRes = $http.send({
      url: 'https://api.mercadolibre.com/users/' + sellerId + '/items/search?q=5420&limit=20',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 15,
    })

    const rawIds = searchRes.json?.results || []
    const targetIds = ['MLB7566367408', 'MLB7566510008', 'MLB7594162228', 'MLB7594728080']
    for (let i = 0; i < rawIds.length; i++) {
      if (targetIds.indexOf(rawIds[i]) === -1 && targetIds.length < 10) targetIds.push(rawIds[i])
    }

    // Multiget dos itens encontrados
    const compactItems = []
    if (targetIds.length > 0) {
      const multiRes = $http.send({
        url: 'https://api.mercadolibre.com/items?ids=' + targetIds.join(','),
        method: 'GET',
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
        timeout: 20,
      })
      if (Array.isArray(multiRes.json)) {
        for (let m = 0; m < multiRes.json.length; m++) {
          const entry = multiRes.json[m]
          if (entry && entry.code === 200 && entry.body) {
            const b = entry.body
            compactItems.push({
              id: b.id,
              title: (b.title || '').substring(0, 70),
              catalog_product_id: b.catalog_product_id,
              catalog_listing: b.catalog_listing,
              condition: b.condition,
              status: b.status,
              created: b.date_created,
              parent: b.parent_item_id,
              attrs: (b.attributes || [])
                .filter((a) => ['ITEM_CONDITION', 'GRADING', 'BRAND', 'MODEL'].indexOf(a.id) >= 0)
                .map((a) => a.id + '=' + a.value_id + '(' + a.value_name + ')'),
            })
          }
        }
      }
    }

    // Periciar MLB18732668
    const pos1873Res = $http.send({
      url: 'https://api.mercadolibre.com/products/MLB18732668',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 10,
    })

    const col = app.findCollectionByNameOrId('ml_ads_fetch_jobs')
    const diag = new Record(col)
    diag.set('status', 'done')
    diag.set('status_filter', '__PERICIA_0332__')
    diag.set('progress_text', 'Pericia de ' + compactItems.length + ' itens')
    diag.set(
      'error_message',
      JSON.stringify({
        items: compactItems,
        pos1873: pos1873Res.json
          ? {
              id: pos1873Res.json.id,
              name: (pos1873Res.json.name || '').substring(0, 60),
              parent_id: pos1873Res.json.parent_id,
              children: pos1873Res.json.children_ids,
            }
          : null,
      }).substring(0, 4900),
    )
    app.save(diag)
  },
  (app) => {},
)
