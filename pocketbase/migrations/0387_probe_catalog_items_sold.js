migrate(
  (app) => {
    let token = ''
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (sRecords && sRecords.length > 0) {
      token = sRecords[0].getString('access_token')
    }

    const testId = 'MLB2010897786'
    const headers = { Authorization: 'Bearer ' + token, Accept: 'application/json' }

    // 1. GET /products/{testId}
    const pRes = $http.send({
      url: 'https://api.mercadolibre.com/products/' + testId,
      method: 'GET',
      headers: headers,
      timeout: 10,
    })
    const pj = pRes.json || {}

    // 2. GET /products/{testId}/items
    const itRes = $http.send({
      url: 'https://api.mercadolibre.com/products/' + testId + '/items',
      method: 'GET',
      headers: headers,
      timeout: 10,
    })
    const itList = itRes.json && itRes.json.results ? itRes.json.results : []
    let sumSold = 0
    let maxSold = 0
    let validCount = 0
    for (let i = 0; i < itList.length; i++) {
      const it = itList[i]
      if (it.sold_quantity != null && !isNaN(Number(it.sold_quantity))) {
        const n = Number(it.sold_quantity)
        sumSold += n
        validCount++
        if (n > maxSold) maxSold = n
      }
    }

    const line = [
      'id=' + testId,
      'p_sold=' + pj.sold_quantity,
      'it_count=' + itList.length,
      'valid_sold_count=' + validCount,
      'sumSold=' + sumSold,
      'maxSold=' + maxSold,
      'bb_sold=' + (pj.buy_box_winner ? pj.buy_box_winner.sold_quantity : 'no_bb'),
      'sample_items=' +
        JSON.stringify(
          itList.slice(0, 3).map(function (x) {
            return { id: x.item_id || x.id, sold: x.sold_quantity, price: x.price }
          }),
        ),
    ].join(' | ')

    const job = app.findRecordById('ml_competitor_jobs', 'wp8elpqepb1vao9')
    job.set('seller_nickname', line.substring(0, 250))
    job.set(
      'error_message',
      JSON.stringify({ pj_keys: Object.keys(pj), itList: itList }).substring(0, 3000),
    )
    app.save(job)
  },
  (app) => {},
)
