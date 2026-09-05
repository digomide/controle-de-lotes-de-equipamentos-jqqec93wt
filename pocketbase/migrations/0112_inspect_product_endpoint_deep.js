migrate(
  (app) => {
    // 0114_test_search_items.js
    let accessToken = ''
    try {
      const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
      if (sRecords && sRecords.length > 0) {
        accessToken = (sRecords[0].getString('access_token') || '').trim()
      }
    } catch (_) {}

    // Testar /users/{id} com token vs sem token
    const uWithToken = $http.send({
      url: 'https://api.mercadolibre.com/users/50650824',
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer ' + accessToken,
      },
      timeout: 10,
    })

    // Testar busca interna com product_id:
    // /sites/MLB/search?product_id=MLB2010941196
    const sByProd = $http.send({
      url: 'https://api.mercadolibre.com/sites/MLB/search?product_id=MLB2010941196',
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer ' + accessToken,
      },
      timeout: 10,
    })

    // Testar /sites/MLB/search?q=MLB4836138319
    const sByMlb = $http.send({
      url: 'https://api.mercadolibre.com/sites/MLB/search?q=MLB4836138319',
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer ' + accessToken,
      },
      timeout: 10,
    })

    // Testar https://api.mercadolibre.com/items/MLB4836138319/description
    const descRes = $http.send({
      url: 'https://api.mercadolibre.com/items/MLB4836138319/description',
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer ' + accessToken,
      },
      timeout: 10,
    })

    throw new Error(
      'RESULTS_114: ' +
        JSON.stringify({
          uWithToken_status: uWithToken.statusCode,
          uWithToken_nick: uWithToken.json ? uWithToken.json.nickname : null,
          sByProd_status: sByProd.statusCode,
          sByProd_len: sByProd.json?.results?.length,
          sByMlb_status: sByMlb.statusCode,
          desc_status: descRes.statusCode,
        }),
    )
  },
  (app) => {},
)
