migrate(
  (app) => {
    let token = ''
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (sRecords && sRecords.length > 0) {
      token = sRecords[0].getString('access_token')
    }

    const winnerItemId = 'MLB4510809603'
    const catalogId = 'MLB2010733747'

    const authHeaders = { Authorization: 'Bearer ' + token, Accept: 'application/json' }
    const resObj = {}

    // 1. GET /items?ids=MLB4510809603
    try {
      const r1 = $http.send({
        url: 'https://api.mercadolibre.com/items?ids=' + winnerItemId,
        method: 'GET',
        headers: authHeaders,
        timeout: 10,
      })
      resObj.multiget_status = r1.statusCode
      if (r1.json && Array.isArray(r1.json) && r1.json[0]) {
        resObj.multiget_code = r1.json[0].code
        if (r1.json[0].body) {
          const b = r1.json[0].body
          resObj.multiget_body = {
            id: b.id,
            title: b.title,
            price: b.price,
            seller_id: b.seller_id,
            available_quantity: b.available_quantity,
            sold_quantity: b.sold_quantity,
            listing_type_id: b.listing_type_id,
            shipping: b.shipping,
            condition: b.condition,
          }
          if (b.seller_id) {
            try {
              const uRes = $http.send({
                url: 'https://api.mercadolibre.com/users/' + b.seller_id,
                method: 'GET',
                headers: authHeaders,
                timeout: 5,
              })
              if (uRes.statusCode === 200 && uRes.json) {
                resObj.winner_seller_nickname = uRes.json.nickname
              }
            } catch (_) {}
          }
        }
      }
    } catch (e1) {
      resObj.multiget_error = String(e1)
    }

    // 2. GET /products/MLB2010733747/items
    try {
      const r2 = $http.send({
        url: 'https://api.mercadolibre.com/products/' + catalogId + '/items',
        method: 'GET',
        headers: authHeaders,
        timeout: 10,
      })
      resObj.prod_items_status = r2.statusCode
      resObj.prod_items_json = r2.json
    } catch (e2) {
      resObj.prod_items_error = String(e2)
    }

    // 3. GET /products/MLB2010733747/candidates ou /offers ou /competition
    try {
      const r3 = $http.send({
        url: 'https://api.mercadolibre.com/products/' + catalogId + '/candidates',
        method: 'GET',
        headers: authHeaders,
        timeout: 10,
      })
      resObj.prod_candidates_status = r3.statusCode
      resObj.prod_candidates_json = r3.json
    } catch (e3) {
      resObj.prod_candidates_error = String(e3)
    }

    // 4. GET /sites/MLB/search?catalog_product_id=MLB2010733747
    try {
      const r4 = $http.send({
        url: 'https://api.mercadolibre.com/sites/MLB/search?catalog_product_id=' + catalogId,
        method: 'GET',
        headers: authHeaders,
        timeout: 10,
      })
      resObj.search_status = r4.statusCode
      if (r4.json && Array.isArray(r4.json.results)) {
        resObj.search_results = r4.json.results.map((it) => ({
          id: it.id,
          title: it.title,
          price: it.price,
          seller: it.seller,
          available_quantity: it.available_quantity,
          listing_type_id: it.listing_type_id,
          shipping: it.shipping,
        }))
      }
    } catch (e4) {
      resObj.search_error = String(e4)
    }

    // Salvar em um job para lermos
    const job = app.findRecordById('ml_competitor_jobs', 'wp8elpqepb1vao9')
    job.set('error_message', JSON.stringify(resObj).substring(0, 2000))
    app.save(job)
  },
  (app) => {},
)
