migrate(
  (app) => {
    // 1. Carregar token ML
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    const token = sRecords[0].getString('access_token')

    // 2. No HTML do Mercado Livre, os resultados são anúncios (itens MLB, ex: MLB7566367408 ou outros).
    // Cada anúncio tem um item ID (MLBxxxxxxxx).
    // Quando consultamos /items/{id}, o ML retorna o `catalog_product_id`!
    // Ex: GET /items/MLB7566367408 retorna catalog_product_id: "MLB2097858038"!
    // E multiget da API do ML:
    // GET /items?ids=MLB1,MLB2,MLB3... com attributes=id,title,catalog_product_id,condition,price
    // Suporta até 20 IDs por requisição!

    // Vamos testar:
    // a) Pegar os 20 primeiros IDs de itens encontrados na página de busca pública de recondicionado
    // b) Fazer GET /items?ids=...&attributes=id,title,catalog_product_id,condition
    // c) Verificar se traz MLB2097858038!

    const pageRes = $http.send({
      url: 'https://lista.mercadolivre.com.br/dell-latitude-5420-recondicionado',
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
      timeout: 10,
    })

    const html = pageRes.raw || ''
    const itemIds = []
    const mRegex = /MLB-?([0-9]{9,12})/g
    let match
    while ((match = mRegex.exec(html)) !== null) {
      itemIds.push('MLB' + match[1])
    }
    const uniqueItemIds = Array.from(new Set(itemIds)).slice(0, 20)

    let multigetRes = null
    let foundCatalogIds = []
    if (uniqueItemIds.length > 0) {
      const multiRes = $http.send({
        url:
          'https://api.mercadolibre.com/items?ids=' +
          uniqueItemIds.join(',') +
          '&attributes=id,title,catalog_product_id,condition',
        method: 'GET',
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
        timeout: 10,
      })
      if (multiRes.statusCode === 200 && Array.isArray(multiRes.json)) {
        multigetRes = multiRes.json
        for (let i = 0; i < multiRes.json.length; i++) {
          const body = multiRes.json[i].body
          if (body && body.catalog_product_id) {
            foundCatalogIds.push({
              itemId: body.id,
              catalog_product_id: body.catalog_product_id,
              is2097: body.catalog_product_id === 'MLB2097858038',
            })
          }
        }
      }
    }

    // Também testar a busca do vendedor ou produtos locais vinculados a catalog_product_id
    // Se o vendedor tiver o item MLB7566367408 nos seus anúncios ou produtos locais,
    // ele já tem catalog_product_id = MLB2097858038!
    const job = app.findFirstRecordByData('ml_catalog_search_jobs', 'id', 'xdy95h9bd0i47xt')
    job.set(
      'progress_text',
      'uniqueItemIds: ' +
        uniqueItemIds.length +
        ' foundCatalogIds: ' +
        foundCatalogIds.length +
        ' has2097: ' +
        foundCatalogIds.some((x) => x.is2097),
    )
    job.set(
      'error_message',
      JSON.stringify({
        uniqueItemIds: uniqueItemIds.slice(0, 10),
        foundCatalogIds: foundCatalogIds,
      }),
    )
    app.save(job)
  },
  (app) => {},
)
