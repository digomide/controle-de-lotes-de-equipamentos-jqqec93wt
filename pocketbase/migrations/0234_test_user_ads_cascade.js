migrate(
  (app) => {
    // 1. Carregar token ML
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    const token = sRecords[0].getString('access_token')

    // 2. Anúncios do usuário INFOPRECOBAIXO:
    // O usuário relatou explicitamente:
    // "Contexto do usuário (AMbicorpFlow, vendedor INFOPRECOBAIXO): o anúncio de catálogo dele,
    // posição MLB2097858038 ("Notebook Dell Latitude 5420 i5 11ª Ger 8GB SSD 256GB W11 Pro Cinza - Excelente (Recondicionado)"),
    // não aparece nos resultados da busca do explorador."
    //
    // E no link enviado:
    // https://www.mercadolivre.com.br/notebook-dell-latitude-5420-i5-11-ger-8gb-ssd-256gb-w11-pro-cinza-excelente-recondicionado/p/MLB2097858038?pdp_filters=item_id%3AMLB7566367408
    // O item do usuário é MLB7566367408!
    //
    // Como encontrar as posições recondicionadas da família de um produto no ML:
    // ESTRATÉGIAS DA CASCATA:
    // 1. Busca Direta por ID de catálogo ou ID de item:
    //    Se o usuário digita MLB2097858038 ou link do anúncio ou MLB7566367408,
    //    resolve via /products/{id} ou se for item resolve via /items/{id} -> catalog_product_id -> /products/{id}!
    // 2. Anúncios do próprio vendedor (INFOPRECOBAIXO):
    //    O vendedor tem anúncios ativos na sua conta ML (ou na tabela local products / ml_ads_fetch_jobs).
    //    Quando o usuário pesquisa "dell latitude 5420" ou "latitude 5420 recondicionado",
    //    buscamos nos anúncios do vendedor (ou na API /users/{user_id}/items/search?q=...)
    //    aqueles que possuem `catalog_product_id`. Se casarem com a família/termos da busca,
    //    incluímos a posição de catálogo na rodada dedicada!
    // 3. Busca direcionada na API /products/search com termos de família + variações:
    //    - q="Dell Latitude 5420"
    //    - q="Latitude 5420"
    //    - q="Dell Latitude 5420 Recondicionado"
    //    - q="Latitude 5420 Excelente"
    //    - q="Latitude 5420 Recondicionado"
    // 4. Scraping público de listagem de recondicionados:
    //    Ex: https://lista.mercadolivre.com.br/<termo>-recondicionado
    //    Extrai links de catálogo /p/MLB... e IDs de anúncios MLB...
    //    Faz multiget de /items?ids=... para extrair `catalog_product_id` dos anúncios recondicionados retornados na busca pública!
    // 5. Enriquecimento de posições da família:
    //    Para cada catalog_product_id coletado, consulta GET /products/{id}
    //    Isso valida a condição real (refurbished / GRADING: Excelente) e preço da Buy Box!

    // Vamos testar no job dronm3nxgpoubkn se o item MLB7566367408 é retornado na busca de anúncios do vendedor:
    const sId = sRecords[0].getString('user_id_ml') || '626774396'
    let userAdsWith5420 = []
    try {
      const uRes = $http.send({
        url: 'https://api.mercadolibre.com/users/' + sId + '/items/search?status=active&limit=50',
        method: 'GET',
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
        timeout: 10,
      })
      if (uRes.statusCode === 200 && uRes.json && uRes.json.results) {
        userAdsWith5420 = uRes.json.results
      }
    } catch (_) {}

    const job = app.findFirstRecordByData('ml_catalog_search_jobs', 'id', 'dronm3nxgpoubkn')
    job.set(
      'progress_text',
      'userAds: ' +
        userAdsWith5420.length +
        ' includes7566: ' +
        userAdsWith5420.includes('MLB7566367408'),
    )
    job.set(
      'error_message',
      JSON.stringify({
        userAdsTotal: userAdsWith5420.length,
        has7566: userAdsWith5420.includes('MLB7566367408'),
        sample: userAdsWith5420.slice(0, 10),
      }),
    )
    app.save(job)
  },
  (app) => {},
)
