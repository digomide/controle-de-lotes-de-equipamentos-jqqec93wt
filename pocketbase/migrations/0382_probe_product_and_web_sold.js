migrate(
  (app) => {
    let token = ''
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (sRecords && sRecords.length > 0) {
      token = sRecords[0].getString('access_token')
    }

    const catId = 'MLB2097858038'
    const headers = { Authorization: 'Bearer ' + token, Accept: 'application/json' }

    // GET /products/MLB2097858038/items
    const itRes = $http.send({
      url: 'https://api.mercadolibre.com/products/' + catId + '/items',
      method: 'GET',
      headers: headers,
      timeout: 10,
    })
    const itList = itRes.json && itRes.json.results ? itRes.json.results : []
    const itemsShort = itList.map(function (it) {
      return {
        item_id: it.item_id || it.id,
        seller_id: it.seller_id,
        price: it.price,
        sold_quantity: it.sold_quantity,
        is_buy_box_winner: it.is_buy_box_winner,
      }
    })

    // GET /items para cada um
    const detailed = []
    for (let i = 0; i < itemsShort.length; i++) {
      const itId = itemsShort[i].item_id
      if (!itId) continue
      try {
        const dRes = $http.send({
          url: 'https://api.mercadolibre.com/items/' + itId,
          method: 'GET',
          headers: headers,
          timeout: 6,
        })
        const dj = dRes.json || {}
        detailed.push({
          id: itId,
          sold_quantity: dj.sold_quantity,
          status: dj.status,
          title: (dj.title || '').substring(0, 30),
        })
      } catch (ed) {
        detailed.push({ id: itId, err: String(ed) })
      }
    }

    // Também testar a página web de MLB2097858038
    // No HTML da página https://www.mercadolivre.com.br/p/MLB2097858038
    let htmlSold = ''
    try {
      const pageRes = $http.send({
        url: 'https://www.mercadolivre.com.br/p/' + catId,
        method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        timeout: 8,
      })
      if (pageRes.statusCode === 200 && pageRes.raw) {
        const body = pageRes.raw
        const m = body.match(/(\+?[0-9.]+\s*mil\s*vendidos|[0-9.]+\s*vendidos)/i)
        if (m) {
          htmlSold = m[0]
        }
      }
    } catch (eh) {
      htmlSold = 'err: ' + String(eh)
    }

    const job = app.findRecordById('ml_competitor_jobs', 'wp8elpqepb1vao9')
    job.set(
      'seller_nickname',
      ('htmlSold=' + htmlSold + ' | items=' + JSON.stringify(itemsShort)).substring(0, 250),
    )
    job.set(
      'error_message',
      JSON.stringify({ itemsShort: itemsShort, detailed: detailed, htmlSold: htmlSold }).substring(
        0,
        3000,
      ),
    )
    app.save(job)
  },
  (app) => {},
)
