migrate(
  (app) => {
    let token = ''
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (sRecords && sRecords.length > 0) {
      token = sRecords[0].getString('access_token')
    }

    const catalogId = 'MLB2010733747'
    const authHeaders = { Authorization: 'Bearer ' + token, Accept: 'application/json' }

    const r = $http.send({
      url: 'https://api.mercadolibre.com/products/' + catalogId + '/items',
      method: 'GET',
      headers: authHeaders,
      timeout: 10,
    })

    let simplified = []
    if (r.statusCode === 200 && r.json && Array.isArray(r.json.results)) {
      simplified = r.json.results.map(function (item) {
        let nick = ''
        if (item.seller_id) {
          try {
            const uRes = $http.send({
              url: 'https://api.mercadolibre.com/users/' + item.seller_id,
              method: 'GET',
              headers: authHeaders,
              timeout: 5,
            })
            if (uRes.statusCode === 200 && uRes.json) {
              nick = uRes.json.nickname
            }
          } catch (_) {}
        }
        return {
          item_id: item.item_id,
          price: item.price,
          seller_id: item.seller_id,
          seller_nickname: nick,
          available_quantity: item.available_quantity,
          sold_quantity: item.sold_quantity,
          condition: item.condition,
          listing_type_id: item.listing_type_id,
          shipping: item.shipping,
          is_buy_box_winner: item.is_buy_box_winner,
          status: item.status,
        }
      })
    }

    const job = app.findRecordById('ml_competitor_jobs', 'wp8elpqepb1vao9')
    job.set(
      'error_message',
      JSON.stringify({ count: simplified.length, items: simplified }).substring(0, 2000),
    )
    app.save(job)
  },
  (app) => {},
)
