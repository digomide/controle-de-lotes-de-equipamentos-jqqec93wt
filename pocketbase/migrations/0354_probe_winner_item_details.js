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

    // 1. GET /items/MLB4510809603
    try {
      const r1 = $http.send({
        url: 'https://api.mercadolibre.com/items/' + winnerItemId,
        method: 'GET',
        headers: authHeaders,
        timeout: 10,
      })
      if (r1.statusCode === 200 && r1.json) {
        const ij = r1.json
        resObj.winner_item = {
          id: ij.id,
          title: ij.title,
          price: ij.price,
          seller_id: ij.seller_id,
          available_quantity: ij.available_quantity,
          sold_quantity: ij.sold_quantity,
          listing_type_id: ij.listing_type_id,
          shipping: ij.shipping,
          condition: ij.condition,
          catalog_product_id: ij.catalog_product_id,
        }
        // Consultar seller nickname
        if (ij.seller_id) {
          try {
            const uRes = $http.send({
              url: 'https://api.mercadolibre.com/users/' + ij.seller_id,
              method: 'GET',
              headers: authHeaders,
              timeout: 5,
            })
            if (uRes.statusCode === 200 && uRes.json) {
              resObj.winner_seller_nickname = uRes.json.nickname
            }
          } catch (_) {}
        }
      } else {
        resObj.winner_item_status = r1.statusCode
      }
    } catch (e1) {
      resObj.winner_item_error = String(e1)
    }

    // 2. GET /products/MLB2010733747
    try {
      const r2 = $http.send({
        url: 'https://api.mercadolibre.com/products/' + catalogId,
        method: 'GET',
        headers: authHeaders,
        timeout: 10,
      })
      if (r2.statusCode === 200 && r2.json) {
        const pj = r2.json
        resObj.catalog_product = {
          id: pj.id,
          name: pj.name,
          price: pj.price,
          buy_box_winner: pj.buy_box_winner,
          parent_id: pj.parent_id,
        }
      } else {
        resObj.catalog_product_status = r2.statusCode
      }
    } catch (e2) {
      resObj.catalog_product_error = String(e2)
    }

    // Salvar em um job para lermos
    const job = app.findRecordById('ml_competitor_jobs', 'wp8elpqepb1vao9')
    job.set('error_message', JSON.stringify(resObj).substring(0, 2000))
    app.save(job)
  },
  (app) => {},
)
