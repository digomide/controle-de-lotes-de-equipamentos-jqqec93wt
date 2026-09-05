migrate(
  (app) => {
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    const token = sRecords[0].getString('access_token')

    // Fazer busca por "dell latitude 3420"
    const res = $http.send({
      url: 'https://api.mercadolibre.com/products/search?status=active&site_id=MLB&domain_id=MLB-NOTEBOOKS&q=dell%20latitude%203420&limit=3&offset=0',
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/json',
      },
      timeout: 10,
    })

    let sampleProduct = null
    let sampleProductDetail = null
    let sampleProductItems = null

    if (res.statusCode === 200 && res.json && res.json.results && res.json.results.length > 0) {
      sampleProduct = res.json.results[0]
      const catId = sampleProduct.id

      // Testar GET /products/{id}
      try {
        const dRes = $http.send({
          url: 'https://api.mercadolibre.com/products/' + catId,
          method: 'GET',
          headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
          timeout: 10,
        })
        if (dRes.statusCode === 200 && dRes.json) {
          sampleProductDetail = {
            id: dRes.json.id,
            name: dRes.json.name,
            status: dRes.json.status,
            buy_box_winner: dRes.json.buy_box_winner,
            settings: dRes.json.settings,
            domain_id: dRes.json.domain_id,
            condition: dRes.json.condition,
            attributes: (dRes.json.attributes || []).map((a) => ({
              id: a.id,
              name: a.name,
              value_id: a.value_id,
              value_name: a.value_name,
            })),
          }
        }
      } catch (e1) {}

      // Testar GET /products/{id}/items
      try {
        const iRes = $http.send({
          url: 'https://api.mercadolibre.com/products/' + catId + '/items',
          method: 'GET',
          headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
          timeout: 10,
        })
        if (iRes.statusCode === 200 && iRes.json) {
          sampleProductItems = iRes.json
        } else {
          sampleProductItems = {
            statusCode: iRes.statusCode,
            raw: String(iRes.raw || '').substring(0, 200),
          }
        }
      } catch (e2) {
        sampleProductItems = { error: String(e2) }
      }
    }

    const job = app.findFirstRecordByData('ml_catalog_search_jobs', 'id', 'szg3o742i7qawmh')
    job.set(
      'error_message',
      JSON.stringify({
        search_product_keys: sampleProduct ? Object.keys(sampleProduct) : [],
        search_product_bb: sampleProduct ? sampleProduct.buy_box_winner : null,
        search_product_attrs:
          sampleProduct && sampleProduct.attributes
            ? sampleProduct.attributes.map((a) => ({ id: a.id, value_name: a.value_name }))
            : [],
        detail: sampleProductDetail,
        itemsEndpoint: sampleProductItems,
      }),
    )
    app.save(job)
  },
  (app) => {},
)
