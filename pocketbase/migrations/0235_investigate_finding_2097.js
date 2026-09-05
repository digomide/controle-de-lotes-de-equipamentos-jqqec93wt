migrate(
  (app) => {
    // 1. Carregar token ML
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    const token = sRecords[0].getString('access_token')

    // 2. Vamos testar encontrar MLB2097858038 através de:
    // a) Anúncio do vendedor MLB7566367408:
    // Se o vendedor tem o anúncio cadastrado nos produtos locais:
    const localProds = app.findRecordsByFilter(
      'products',
      "ml_listing_id = 'MLB7566367408' || catalog_product_id = 'MLB2097858038'",
      '',
      10,
      0,
    )

    // b) Anúncios do vendedor salvos em ml_ads_fetch_jobs:
    // Em ml_ads_fetch_jobs temos o dump de todos os 564 anúncios de INFOPRECOBAIXO!
    const adsJobs = app.findRecordsByFilter(
      'ml_ads_fetch_jobs',
      "status = 'done' && items_count > 0",
      '-created',
      1,
      0,
    )
    let foundInDump = null
    if (adsJobs.length > 0) {
      const allItems = adsJobs[0].get('items') || []
      for (let i = 0; i < allItems.length; i++) {
        if (
          allItems[i].id === 'MLB7566367408' ||
          allItems[i].catalog_product_id === 'MLB2097858038'
        ) {
          foundInDump = allItems[i]
          break
        }
      }
    }

    // c) Consulta direta do item MLB7566367408 na API do ML:
    let itemFromApi = null
    try {
      const itRes = $http.send({
        url: 'https://api.mercadolibre.com/items/MLB7566367408',
        method: 'GET',
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
        timeout: 8,
      })
      if (itRes.statusCode === 200 && itRes.json) {
        itemFromApi = {
          id: itRes.json.id,
          title: itRes.json.title,
          catalog_product_id: itRes.json.catalog_product_id,
          catalog_listing: itRes.json.catalog_listing,
          condition: itRes.json.condition,
        }
      }
    } catch (_) {}

    // d) E a busca no catálogo /products/search por palavras do título:
    // "Notebook Dell Latitude 5420 i5 11ª Ger 8GB SSD 256GB W11 Pro Cinza - Excelente (Recondicionado)"
    // O que acontece quando buscamos "Latitude 5420 Excelente" ou "Latitude 5420 Recondicionado"
    // ou "Dell Latitude 5420 Recondicionado"?
    const q1 = 'Dell Latitude 5420 Recondicionado'
    let q1Res = null
    try {
      const r = $http.send({
        url:
          'https://api.mercadolibre.com/products/search?status=active&site_id=MLB&q=' +
          encodeURIComponent(q1) +
          '&limit=50',
        method: 'GET',
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
        timeout: 8,
      })
      if (r.statusCode === 200 && r.json && Array.isArray(r.json.results)) {
        q1Res = {
          total: r.json.paging ? r.json.paging.total : 0,
          count: r.json.results.length,
          has2097: r.json.results.some((x) => x.id === 'MLB2097858038'),
          sampleTitles: r.json.results.slice(0, 5).map((x) => x.id + ': ' + x.name),
        }
      }
    } catch (_) {}

    // Salvar num job para podermos ler o resumo no próximo teste
    const job = app.findFirstRecordByData('ml_catalog_search_jobs', 'id', 'j18om2amo2hgt4c')
    job.set(
      'progress_text',
      'local: ' +
        localProds.length +
        ' dump: ' +
        Boolean(foundInDump) +
        ' api: ' +
        Boolean(itemFromApi) +
        ' q1has2097: ' +
        (q1Res ? q1Res.has2097 : false),
    )
    job.set(
      'error_message',
      JSON.stringify({
        foundInDump: foundInDump,
        itemFromApi: itemFromApi,
        q1Res: q1Res,
      }),
    )
    app.save(job)
  },
  (app) => {},
)
