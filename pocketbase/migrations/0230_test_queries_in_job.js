migrate(
  (app) => {
    // 1. Carregar token ML
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    const token = sRecords[0].getString('access_token')

    // 2. Testar busca pelo ID do item ou do produto:
    // O usuário é dono de MLB7566367408!
    // Podemos consultar os anúncios do usuário via GET /users/626774396/items/search?status=active
    // e para qualquer item do usuário que tenha catalog_product_id, ou que case com a busca!
    // Mas antes: como a busca do ML encontra MLB2097858038 diretamente pelo termo de busca?
    // Vamos testar:
    // a) GET /products/search?status=active&site_id=MLB&q=MLB2097858038
    // b) GET /products/search?status=active&site_id=MLB&product_id=MLB2097858038
    // c) GET /products/search?status=active&site_id=MLB&catalog_product_id=MLB2097858038
    // d) GET /products/search?status=active&site_id=MLB&q=Latitude 5420 Cinza
    // e) GET /products/search?status=active&site_id=MLB&q=Latitude 5420 Excelente (Recondicionado)
    // f) GET /products/search?status=active&site_id=MLB&q=Dell Latitude 5420 i5 11ª
    // g) GET /products/search?status=active&site_id=MLB&q=069701804423 (Homologação Anatel)

    const tests = [
      { name: 'anatel', q: '069701804423' },
      { name: 'full_title', q: 'Latitude 5420 Excelente (Recondicionado)' },
      { name: 'lat_excelente', q: 'Latitude 5420 Excelente' },
      { name: 'lat_cinza', q: 'Latitude 5420 Cinza' },
      { name: 'dell_lat_cinza', q: 'Dell Latitude 5420 Cinza' },
      { name: 'dell_5420_excelente', q: 'Dell 5420 Excelente' },
    ]

    const out = []
    for (let i = 0; i < tests.length; i++) {
      try {
        const u =
          'https://api.mercadolibre.com/products/search?status=active&site_id=MLB&q=' +
          encodeURIComponent(tests[i].q) +
          '&limit=50'
        const r = $http.send({
          url: u,
          method: 'GET',
          headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
          timeout: 8,
        })
        const resList = r.json && Array.isArray(r.json.results) ? r.json.results : []
        const has2097 = resList.some((x) => x.id === 'MLB2097858038')
        out.push({
          name: tests[i].name,
          q: tests[i].q,
          count: resList.length,
          total: r.json && r.json.paging ? r.json.paging.total : 0,
          has2097: has2097,
          ids: resList.map((x) => x.id).slice(0, 5),
        })
      } catch (e) {
        out.push({ name: tests[i].name, err: String(e) })
      }
    }

    // Salvar num job que podemos ler
    const job = app.findFirstRecordByData('ml_catalog_search_jobs', 'id', '7vzftrlly3on20r')
    job.set(
      'progress_text',
      'Tests: ' + out.map((o) => o.name + ':' + o.has2097 + '(' + o.total + ')').join(', '),
    )
    job.set('error_message', JSON.stringify(out))
    app.save(job)
  },
  (app) => {},
)
