migrate(
  (app) => {
    // 0104_inspect_product_full.js
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

    // Testar também /products/MLB2010941196/items se existir
    let itemsSub = null
    try {
      const resItems = $http.send({
        url: 'https://api.mercadolibre.com/products/MLB2010941196/items',
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer ' + accessToken,
        },
        timeout: 10,
      })
      itemsSub = { status: resItems.statusCode, json: resItems.json }
    } catch (eSub) {
      itemsSub = { err: String(eSub) }
    }

    // Testar /items/{id} com MLB4836138319 e MLB2010941196
    // Também testar GET /items?ids=MLB2010941196,MLB4836138319
    let multigetRes = null
    try {
      const mg = $http.send({
        url: 'https://api.mercadolibre.com/items?ids=MLB2010941196,MLB4836138319',
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer ' + accessToken,
        },
        timeout: 10,
      })
      multigetRes = { status: mg.statusCode, json: mg.json }
    } catch (eMg) {
      multigetRes = { err: String(eMg) }
    }

    const output = {
      product: {
        id: data.id,
        name: data.name,
        status: data.status,
        children_ids: data.children_ids,
        buy_box_winner: data.buy_box_winner,
        price: data.price,
        pictures: (data.pictures || []).map((p) => p.url).slice(0, 3),
      },
      itemsSub,
      multigetRes,
    }

    job.set('error_message', JSON.stringify(output).substring(0, 1500))
    app.save(job)
  },
  (app) => {},
)
