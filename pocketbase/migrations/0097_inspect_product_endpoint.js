migrate(
  (app) => {
    // 0097_inspect_product_endpoint.js
    const job = app.findFirstRecordByData(
      'ml_competitor_jobs',
      'query',
      'probe_mlb_sources_2010941196',
    )

    let accessToken = ''
    try {
      const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
      if (sRecords && sRecords.length > 0) {
        accessToken = (sRecords[0].getString('access_token') || '').trim()
      }
    } catch (_) {}

    const res = $http.send({
      url: 'https://api.mercadolibre.com/products/MLB2010941196',
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer ' + accessToken,
      },
      timeout: 10,
    })

    const data = res.json || {}
    const info = {
      status: res.statusCode,
      id: data.id,
      name: data.name,
      buy_box_winner: data.buy_box_winner,
      price: data.price,
      sold_quantity: data.sold_quantity,
      status_field: data.status,
      attributes_count: (data.attributes || []).length,
      first_pic: data.pictures && data.pictures[0] ? data.pictures[0].url : null,
      children_ids: data.children_ids,
    }

    job.set('error_message', JSON.stringify(info))
    app.save(job)
  },
  (app) => {},
)
