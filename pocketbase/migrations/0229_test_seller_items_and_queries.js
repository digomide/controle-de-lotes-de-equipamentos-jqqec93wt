migrate(
  (app) => {
    // 1. Carregar token ML
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    const token = sRecords[0].getString('access_token')

    // 2. Anúncios do usuário na collection ml_ads_fetch_jobs:
    const sellerAdsJobs = app.findRecordsByFilter(
      'ml_ads_fetch_jobs',
      "status = 'done' && items_count > 0",
      '-created',
      1,
      0,
    )
    let found7566 = false
    let catalogIdsFromSeller = []
    if (sellerAdsJobs.length > 0) {
      const itemsList = sellerAdsJobs[0].get('items') || []
      for (let i = 0; i < itemsList.length; i++) {
        const item = itemsList[i]
        if (item.id === 'MLB7566367408') {
          found7566 = true
        }
        if (item.catalog_product_id) {
          catalogIdsFromSeller.push(item.catalog_product_id)
        }
      }
    }

    // 3. Vamos testar obter os anúncios de catálogo do vendedor ativo pelo endpoint:
    // GET /users/626774396/items/search?status=active
    // E multiget de 50 itens por vez com attributes=id,title,catalog_product_id,catalog_listing
    // Isso dá exatamente TODOS os catalog_product_id que o vendedor já publica ou tem vínculo!

    // 4. Além disso: buscar no catálogo oficial /products/search com filtros:
    // O que acontece quando buscamos pelo título do produto:
    // "Notebook Dell Latitude 5420 i5 11" ou "Notebook Dell Latitude 5420 i5 11ª Ger 8GB SSD 256GB"
    const rExact = $http.send({
      url:
        'https://api.mercadolibre.com/products/search?status=active&site_id=MLB&q=' +
        encodeURIComponent('Notebook Dell Latitude 5420 i5') +
        '&limit=50',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 10,
    })
    const has2097InExact =
      rExact.json &&
      Array.isArray(rExact.json.results) &&
      rExact.json.results.some((x) => x.id === 'MLB2097858038')

    // O que acontece se buscamos por variações:
    // /products/search?status=active&site_id=MLB&q=Latitude 5420 i5 11
    const rI5 = $http.send({
      url:
        'https://api.mercadolibre.com/products/search?status=active&site_id=MLB&q=' +
        encodeURIComponent('Latitude 5420 i5 11') +
        '&limit=50',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 10,
    })
    const has2097InI5 =
      rI5.json &&
      Array.isArray(rI5.json.results) &&
      rI5.json.results.some((x) => x.id === 'MLB2097858038')

    // Gravar no log da console do pb_hooks
    console.log(
      '[MIGRATION_0229_LOG] found7566:',
      found7566,
      'catalogIdsCount:',
      catalogIdsFromSeller.length,
      'has2097InExact:',
      has2097InExact,
      'has2097InI5:',
      has2097InI5,
    )
  },
  (app) => {},
)
