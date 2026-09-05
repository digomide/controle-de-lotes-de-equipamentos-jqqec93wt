migrate(
  (app) => {
    // 1. Carregar token ML
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    const token = sRecords[0].getString('access_token')

    // 2. Anúncio do vendedor MLB7566367408
    const itemRes = $http.send({
      url: 'https://api.mercadolibre.com/items/MLB7566367408',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 10,
    })

    // 3. Buscar anúncios do usuário pelo título ou family
    // O usuário tem 564 anúncios. Podemos consultar /users/626774396/items/search?status=active
    // e para itens multiget ou itens de catálogo, ou buscar itens com catalog_listing
    const col = app.findCollectionByNameOrId('ml_ads_fetch_jobs')
    const rec = new Record(col)
    rec.set('status', 'done')
    rec.set('status_filter', '__ITEM_7566_RAW__')
    rec.set('progress_text', 'item status: ' + itemRes.statusCode)
    rec.set(
      'error_message',
      JSON.stringify({
        id: itemRes.json ? itemRes.json.id : null,
        title: itemRes.json ? itemRes.json.title : null,
        catalog_product_id: itemRes.json ? itemRes.json.catalog_product_id : null,
        catalog_listing: itemRes.json ? itemRes.json.catalog_listing : null,
        condition: itemRes.json ? itemRes.json.condition : null,
        attributes: (itemRes.json && itemRes.json.attributes ? itemRes.json.attributes : []).filter(
          (a) =>
            ['BRAND', 'MODEL', 'GRADING', 'ITEM_CONDITION'].includes((a.id || '').toUpperCase()),
        ),
      }),
    )
    app.save(rec)
  },
  (app) => {},
)
