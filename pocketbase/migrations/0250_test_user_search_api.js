migrate(
  (app) => {
    // 0250: Copiar info de rec.progress_text para testJob de busca direta
    const rec = app.findFirstRecordByData('ml_catalog_search_jobs', 'query', '__PROBE_0243_VIEW__')
    const txt = rec ? rec.getString('progress_text') : 'no rec'

    // Também testar a consulta na API do Mercado Livre pelo seller_id
    // GET /users/626774396/items/search?q=5420
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    const token = sRecords.length > 0 ? sRecords[0].getString('access_token') : ''
    const sellerId = sRecords.length > 0 ? sRecords[0].getString('user_id_ml') : '626774396'

    let apiItems = []
    try {
      const res = $http.send({
        url:
          'https://api.mercadolibre.com/users/' +
          sellerId +
          '/items/search?q=' +
          encodeURIComponent('5420'),
        method: 'GET',
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
        timeout: 10,
      })
      if (res.statusCode === 200 && res.json && res.json.results) {
        apiItems = res.json.results
      }
    } catch (_) {}

    // Gravar no log do PocketBase
    console.log('RESULT_0250: progress=' + txt + ' apiItems=' + JSON.stringify(apiItems))
  },
  (app) => {},
)
