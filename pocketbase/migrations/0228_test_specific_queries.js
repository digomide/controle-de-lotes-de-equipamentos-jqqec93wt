migrate(
  (app) => {
    // 1. Carregar token ML
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    const token = sRecords[0].getString('access_token')

    // 2. Investigar busca:
    // Como a API /products/search suporta busca por atributos ou status?
    // Exemplo:
    // GET /products/search?status=active&site_id=MLB&family_name=Dell%20Latitude%205420
    // GET /products/search?status=active&site_id=MLB&product_identifier=...
    // GET /products/search?status=active&site_id=MLB&q=Dell%20Latitude%205420%20Cinza
    // GET /products/search?status=active&site_id=MLB&q=Latitude%205420%20Excelente
    // GET /products/search?status=active&site_id=MLB&q=Latitude%205420%20i5%2011%208GB
    // GET /products/search?status=active&site_id=MLB&q=Dell%205420%20recondicionado
    // GET /products/search?status=active&site_id=MLB&q=Latitude%205420%20(Recondicionado)
    // E também: produtos da loja do vendedor INFOPRECOBAIXO ou produtos que o vendedor vende!
    // No ML:
    // GET /users/626774396/items/search?status=active
    // E pegar os catalog_product_id dos anúncios de catálogo do vendedor!

    const qTests = [
      'Latitude 5420 Excelente',
      'Dell Latitude 5420 Cinza Excelente',
      'Dell Latitude 5420 Recondicionado',
      'Latitude 5420 8GB 256GB',
      'Notebook Dell Latitude 5420 i5 11',
    ]

    const foundMatches = []
    for (let i = 0; i < qTests.length; i++) {
      try {
        const u =
          'https://api.mercadolibre.com/products/search?status=active&site_id=MLB&q=' +
          encodeURIComponent(qTests[i]) +
          '&limit=50'
        const r = $http.send({
          url: u,
          method: 'GET',
          headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
          timeout: 10,
        })
        if (r.statusCode === 200 && r.json && Array.isArray(r.json.results)) {
          const has2097 = r.json.results.some((x) => x.id === 'MLB2097858038')
          foundMatches.push({
            q: qTests[i],
            count: r.json.results.length,
            total: r.json.paging ? r.json.paging.total : 0,
            has2097: has2097,
          })
        }
      } catch (err) {}
    }

    // Também: consultar os anúncios do vendedor (seller_id 626774396)
    // Em ml_ads_fetch_jobs, todos os anúncios do usuário já foram baixados!
    // Vamos verificar se nos anúncios do usuário (ou via GET /users/626774396/items/search)
    // há anúncios de catálogo e seus catalog_product_ids!
    const sellerAdsJobs = app.findRecordsByFilter(
      'ml_ads_fetch_jobs',
      "status = 'done' && items_count > 0",
      '-created',
      1,
      0,
    )
    let sellerCatalogIds = []
    if (sellerAdsJobs.length > 0) {
      const itemsList = sellerAdsJobs[0].get('items') || []
      // Se itemsList tiver strings de MLB IDs ou objetos:
      if (Array.isArray(itemsList)) {
        sellerCatalogIds.push('items_is_array_len_' + itemsList.length)
        if (itemsList.length > 0 && typeof itemsList[0] === 'object') {
          for (let m = 0; m < itemsList.length; m++) {
            if (itemsList[m].catalog_product_id) {
              sellerCatalogIds.push(itemsList[m].catalog_product_id)
            }
          }
        }
      }
    }

    const diagJobs = app.findRecordsByFilter(
      'ml_catalog_search_jobs',
      "query = '__DIAGNOSTIC_5420__'",
      '',
      1,
      0,
    )
    if (diagJobs.length > 0) {
      diagJobs[0].set('progress_text', 'qTests: ' + JSON.stringify(foundMatches))
      diagJobs[0].set(
        'error_message',
        'sellerCatalogIds: ' + JSON.stringify(sellerCatalogIds.slice(0, 20)),
      )
      app.save(diagJobs[0])
    }
  },
  (app) => {},
)
