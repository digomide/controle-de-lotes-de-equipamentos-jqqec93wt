migrate(
  (app) => {
    // 1. Carregar token ML
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    const token = sRecords[0].getString('access_token')

    // 2. Testar mais queries em /products/search para achar MLB2097858038
    // O nome oficial do produto no catálogo é:
    // "Notebook Dell Latitude 5420 I5 11° Ger 8gb Ssd 256gb W11 Pro Cinza - Excelente (Recondicionado)"
    // Vamos testar:
    const queries = [
      'Dell Latitude 5420 Excelente',
      'Dell Latitude 5420 Cinza',
      'Latitude 5420 Cinza Excelente',
      'Latitude 5420 256gb Excelente',
      'Dell Latitude 5420 i5 11°',
      'Dell Latitude 5420 11° Ger',
      'Notebook Dell Latitude 5420 I5 11° Ger',
    ]

    const hits = []
    for (let i = 0; i < queries.length; i++) {
      try {
        const r = $http.send({
          url:
            'https://api.mercadolibre.com/products/search?status=active&site_id=MLB&q=' +
            encodeURIComponent(queries[i]) +
            '&limit=50',
          method: 'GET',
          headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
          timeout: 8,
        })
        if (r.statusCode === 200 && r.json && Array.isArray(r.json.results)) {
          const has2097 = r.json.results.some((x) => x.id === 'MLB2097858038')
          hits.push({
            q: queries[i],
            total: r.json.paging ? r.json.paging.total : 0,
            count: r.json.results.length,
            has2097: has2097,
          })
        }
      } catch (_) {}
    }

    // 3. E se consultarmos o vendedor INFOPRECOBAIXO:
    // Nos anúncios de INFOPRECOBAIXO, o item MLB7566367408 está ativo!
    // Se o usuário pesquisa "dell latitude 5420" ou qualquer query,
    // podemos olhar nos anúncios do vendedor (ou produtos locais) se há algum anúncio de catálogo
    // relacionado à busca (ex: com latitude 5420 no título ou modelo), e injetar seu catalog_product_id!
    // E também: o usuário pode colar o MLB do anúncio (MLB7566367408) no campo de busca!
    // Se o usuário colar MLB7566367408, o explorador detecta que é um anúncio (item),
    // consulta /items/MLB7566367408 -> catalog_product_id: MLB2097858038 -> abre o catálogo!

    const job = app.findFirstRecordByData('ml_catalog_search_jobs', 'id', '8dxx4vszs9a5i1w')
    job.set('progress_text', 'hits: ' + JSON.stringify(hits))
    app.save(job)
  },
  (app) => {},
)
