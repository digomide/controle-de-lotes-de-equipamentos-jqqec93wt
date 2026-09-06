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
        return {
          item_id: item.item_id,
          price: item.price,
          seller_id: item.seller_id,
          available_quantity: item.available_quantity,
          listing_type_id: item.listing_type_id,
          free_shipping: item.shipping ? item.shipping.free_shipping : null,
          shipping_mode: item.shipping ? item.shipping.mode : null,
          is_buy_box_winner: item.is_buy_box_winner,
          status: item.status,
        }
      })
    }

    // Pegar também o price_to_win do anúncio próprio MLB5193740831 se disponível
    let ptwPrice = null
    let ptwStatus = ''
    try {
      const ptwRes = $http.send({
        url: 'https://api.mercadolibre.com/items/MLB5193740831/price_to_win?siteId=MLB&version=v2',
        method: 'GET',
        headers: authHeaders,
        timeout: 8,
      })
      if (ptwRes.statusCode === 200 && ptwRes.json) {
        ptwPrice = ptwRes.json.price_to_win
        ptwStatus = ptwRes.json.status
      }
    } catch (_) {}

    const job = app.findRecordById('ml_competitor_jobs', 'wp8elpqepb1vao9')
    job.set(
      'error_message',
      JSON.stringify({ items: simplified, ptwPrice: ptwPrice, ptwStatus: ptwStatus }).substring(
        0,
        2000,
      ),
    )
    app.save(job)
  },
  (app) => {},
)
