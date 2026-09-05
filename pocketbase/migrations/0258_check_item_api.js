migrate(
  (app) => {
    // 0258: Investigar na API do ML como obter o item 7566 ou se ele está nos anúncios da conta
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    const token = sRecords.length > 0 ? sRecords[0].getString('access_token') : ''
    const sellerId = sRecords.length > 0 ? sRecords[0].getString('user_id_ml') : '626774396'

    // Consultar o item MLB7566367408 na API oficial
    let itemStatus = 0
    let itemData = null
    try {
      const res = $http.send({
        url: 'https://api.mercadolibre.com/items/MLB7566367408',
        method: 'GET',
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
        timeout: 10,
      })
      itemStatus = res.statusCode
      if (res.statusCode === 200 && res.json) {
        itemData = {
          id: res.json.id,
          title: res.json.title,
          seller_id: res.json.seller_id,
          catalog_product_id: res.json.catalog_product_id,
          catalog_listing: res.json.catalog_listing,
          condition: res.json.condition,
          status: res.json.status,
        }
      }
    } catch (_) {}

    const testJob = app.findFirstRecordByData(
      'ml_catalog_search_jobs',
      'query',
      '__PROBE_0243_VIEW__',
    )
    if (testJob) {
      testJob.set(
        'progress_text',
        'API_7566: status=' + itemStatus + ' data=' + JSON.stringify(itemData),
      )
      app.save(testJob)
    }
  },
  (app) => {},
)
