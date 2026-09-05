migrate(
  (app) => {
    // 1. Carregar token ML
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    const token = sRecords[0].getString('access_token')

    // 2. Anúncios do usuário INFOPRECOBAIXO:
    // O usuário tem o anúncio MLB7566367408 ("Notebook Dell Latitude 5420 i5 11ª Ger...").
    // Podemos consultar os anúncios do vendedor ou buscar itens do vendedor vinculados ao catálogo!
    // No ML:
    // GET /users/626774396/items/search?catalog_listing=true (ou similar)
    // Ou GET /items/MLB7566367408 -> catalog_product_id: MLB2097858038!
    const resItem = $http.send({
      url: 'https://api.mercadolibre.com/items/MLB7566367408',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 10,
    })

    // E também: GET /users/626774396/items/search?status=active&limit=50
    const resSellerItems = $http.send({
      url: 'https://api.mercadolibre.com/users/626774396/items/search?status=active&limit=50',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 10,
    })

    const col = app.findCollectionByNameOrId('ml_ads_fetch_jobs')
    const rec = new Record(col)
    rec.set('status', 'done')
    rec.set('status_filter', '__SELLER_ITEMS_PROBE__')
    rec.set(
      'progress_text',
      'item 7566: status ' +
        resItem.statusCode +
        ' catalog_product_id: ' +
        (resItem.json ? resItem.json.catalog_product_id : 'null'),
    )
    rec.set(
      'error_message',
      JSON.stringify({
        item_catalog_product_id: resItem.json ? resItem.json.catalog_product_id : null,
        item_catalog_listing: resItem.json ? resItem.json.catalog_listing : null,
        seller_items_count:
          resItem.json && resSellerItems.json ? (resSellerItems.json.results || []).length : 0,
        seller_items_sample: resSellerItems.json
          ? (resSellerItems.json.results || []).slice(0, 10)
          : [],
      }),
    )
    app.save(rec)
  },
  (app) => {},
)
