migrate(
  (app) => {
    // 1. Carregar token ML
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    const token = sRecords[0].getString('access_token')

    // 2. Anúncios do vendedor:
    // O vendedor INFOPRECOBAIXO tem seller_id 626774396.
    // Vamos verificar se nos anúncios do vendedor temos itens de catálogo relacionados à busca:
    // Por exemplo, buscando itens do vendedor:
    // GET /users/626774396/items/search?status=active&limit=50
    // Ou buscando anúncios do vendedor com q=latitude ou q=5420:
    // GET /users/626774396/items/search?status=active&q=5420
    // Ou GET /users/626774396/items/search?status=active&q=latitude
    // E também: produtos da loja do vendedor ou produtos locais vinculados a catalog_product_id!

    // Além disso, na collection "products" do sistema, temos produtos com catalog_product_id ou ml_listing_id:
    // Vamos consultar se temos produtos locais com 5420 ou MLB2097858038!
    const localProds = app.findRecordsByFilter(
      'products',
      "model ~ '5420' || name ~ '5420' || description ~ '5420'",
      '',
      10,
      0,
    )
    const localMatches = localProds.map((p) => ({
      id: p.id,
      name: p.getString('name'),
      model: p.getString('model'),
      catalog_product_id: p.getString('catalog_product_id'),
      ml_listing_id: p.getString('ml_listing_id'),
    }))

    // E também consultar anúncios do vendedor via API do ML com q=5420:
    let seller5420Items = []
    try {
      const sRes = $http.send({
        url:
          'https://api.mercadolibre.com/users/626774396/items/search?status=active&q=' +
          encodeURIComponent('5420'),
        method: 'GET',
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
        timeout: 10,
      })
      if (sRes.statusCode === 200 && sRes.json && sRes.json.results) {
        seller5420Items = sRes.json.results
      }
    } catch (_) {}

    // E para cada item do vendedor achado com 5420, buscar o catalog_product_id via /items/{id}
    const sellerCatalogDiscovered = []
    for (let k = 0; k < Math.min(5, seller5420Items.length); k++) {
      try {
        const itemDetail = $http.send({
          url: 'https://api.mercadolibre.com/items/' + seller5420Items[k],
          method: 'GET',
          headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
          timeout: 6,
        })
        if (itemDetail.statusCode === 200 && itemDetail.json) {
          sellerCatalogDiscovered.push({
            itemId: itemDetail.json.id,
            title: itemDetail.json.title,
            catalog_product_id: itemDetail.json.catalog_product_id,
          })
        }
      } catch (_) {}
    }

    const job = app.findFirstRecordByData('ml_catalog_search_jobs', 'id', 'j5va5w9d904d6yl')
    job.set(
      'progress_text',
      'localMatches: ' +
        localMatches.length +
        ' seller5420: ' +
        seller5420Items.length +
        ' catDiscovered: ' +
        sellerCatalogDiscovered.length,
    )
    job.set(
      'error_message',
      JSON.stringify({
        localMatches: localMatches,
        seller5420Items: seller5420Items,
        sellerCatalogDiscovered: sellerCatalogDiscovered,
      }),
    )
    app.save(job)
  },
  (app) => {},
)
