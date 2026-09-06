migrate(
  (app) => {
    let token = ''
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (sRecords && sRecords.length > 0) {
      token = sRecords[0].getString('access_token')
    }

    const catId = 'MLB2097858038'
    const headers = { Authorization: 'Bearer ' + token, Accept: 'application/json' }

    // 1. GET /products/MLB2097858038
    let prodRes = null
    try {
      const r = $http.send({
        url: 'https://api.mercadolibre.com/products/' + catId,
        method: 'GET',
        headers: headers,
        timeout: 10,
      })
      prodRes = {
        status: r.statusCode,
        keys: r.json ? Object.keys(r.json) : [],
        sold_quantity: r.json ? r.json.sold_quantity : null,
        buy_box_winner: r.json ? r.json.buy_box_winner : null,
      }
    } catch (e1) {
      prodRes = { err: String(e1) }
    }

    // 2. GET /products/MLB2097858038/items
    let itemsRes = null
    try {
      const r = $http.send({
        url: 'https://api.mercadolibre.com/products/' + catId + '/items',
        method: 'GET',
        headers: headers,
        timeout: 10,
      })
      const list = r.json ? (Array.isArray(r.json) ? r.json : r.json.results || []) : []
      let sumSold = 0
      let maxSold = 0
      const summaryList = list.map((it) => {
        const sq = it.sold_quantity
        if (sq != null && !isNaN(Number(sq))) {
          sumSold += Number(sq)
          if (Number(sq) > maxSold) maxSold = Number(sq)
        }
        return {
          id: it.id || it.item_id,
          seller_id: it.seller_id,
          price: it.price,
          sold_quantity: it.sold_quantity,
          is_buy_box_winner: it.is_buy_box_winner,
        }
      })
      itemsRes = {
        status: r.statusCode,
        count: list.length,
        sumSold: sumSold,
        maxSold: maxSold,
        sample: summaryList.slice(0, 10),
      }
    } catch (e2) {
      itemsRes = { err: String(e2) }
    }

    // 3. GET /sites/MLB/search?catalog_product_id=MLB2097858038
    let searchRes = null
    try {
      const r = $http.send({
        url: 'https://api.mercadolibre.com/sites/MLB/search?catalog_product_id=' + catId,
        method: 'GET',
        headers: headers,
        timeout: 10,
      })
      const list = r.json && r.json.results ? r.json.results : []
      let sumSold = 0
      const sSample = list.map((it) => {
        const sq = it.sold_quantity
        if (sq != null && !isNaN(Number(sq))) {
          sumSold += Number(sq)
        }
        return {
          id: it.id,
          title: it.title,
          sold_quantity: it.sold_quantity,
          catalog_product_id: it.catalog_product_id,
        }
      })
      searchRes = {
        status: r.statusCode,
        total: r.json && r.json.paging ? r.json.paging.total : 0,
        count: list.length,
        sumSold: sumSold,
        sample: sSample.slice(0, 10),
      }
    } catch (e3) {
      searchRes = { err: String(e3) }
    }

    // 4. GET /products/search?status=active&site_id=MLB&q=dell%20latitude%205420
    let prodSearchRes = null
    try {
      const r = $http.send({
        url: 'https://api.mercadolibre.com/products/search?status=active&site_id=MLB&q=dell%20latitude%205420&limit=5',
        method: 'GET',
        headers: headers,
        timeout: 10,
      })
      const list = r.json && r.json.results ? r.json.results : []
      const found2097 = list.find((p) => p.id === catId)
      prodSearchRes = {
        status: r.statusCode,
        count: list.length,
        sample0: list[0]
          ? {
              id: list[0].id,
              name: list[0].name,
              keys: Object.keys(list[0]),
              sold_quantity: list[0].sold_quantity,
              bb: list[0].buy_box_winner,
            }
          : null,
        found2097: found2097
          ? {
              id: found2097.id,
              name: found2097.name,
              sold_quantity: found2097.sold_quantity,
              bb: found2097.buy_box_winner,
            }
          : null,
      }
    } catch (e4) {
      prodSearchRes = { err: String(e4) }
    }

    const diag = {
      catId: catId,
      prodRes: prodRes,
      itemsRes: itemsRes,
      searchRes: searchRes,
      prodSearchRes: prodSearchRes,
    }

    const job = app.findRecordById('ml_competitor_jobs', 'wp8elpqepb1vao9')
    job.set('error_message', JSON.stringify(diag).substring(0, 4000))
    app.save(job)
  },
  (app) => {},
)
