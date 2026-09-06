migrate(
  (app) => {
    let token = ''
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (sRecords && sRecords.length > 0) {
      token = sRecords[0].getString('access_token')
    }

    const testUrl =
      'https://api.mercadolibre.com/sites/MLB/search?q=dell%20latitude%205420&limit=50'
    const r = $http.send({
      url: testUrl,
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 10,
    })

    const results = (r.json && r.json.results) || []
    let withCatalogId = 0
    let withSold = 0
    let sumSoldAll = 0
    const catalogMap = {}

    for (let i = 0; i < results.length; i++) {
      const it = results[i]
      const catId = it.catalog_product_id
      const sold = it.sold_quantity != null ? Number(it.sold_quantity) : 0
      if (sold > 0) {
        withSold++
        sumSoldAll += sold
      }
      if (catId) {
        withCatalogId++
        if (!catalogMap[catId]) {
          catalogMap[catId] = {
            count: 0,
            sumSold: 0,
            maxSold: 0,
            sampleItem: it.id,
            title: (it.title || '').substring(0, 30),
          }
        }
        catalogMap[catId].count++
        catalogMap[catId].sumSold += sold
        if (sold > catalogMap[catId].maxSold) catalogMap[catId].maxSold = sold
      }
    }

    const catEntries = Object.keys(catalogMap).map(function (k) {
      return {
        catId: k,
        count: catalogMap[k].count,
        sumSold: catalogMap[k].sumSold,
        maxSold: catalogMap[k].maxSold,
        title: catalogMap[k].title,
      }
    })

    const line = [
      'total_results=' + results.length,
      'withCatalogId=' + withCatalogId,
      'withSold=' + withSold,
      'sumSoldAll=' + sumSoldAll,
      'cats=' + JSON.stringify(catEntries.slice(0, 4)),
    ].join(' | ')

    const job = app.findRecordById('ml_competitor_jobs', 'wp8elpqepb1vao9')
    job.set('seller_nickname', line.substring(0, 250))
    job.set(
      'error_message',
      JSON.stringify({
        catEntries: catEntries,
        sample: results.slice(0, 5).map(function (x) {
          return { id: x.id, title: x.title, cat: x.catalog_product_id, sold: x.sold_quantity }
        }),
      }),
    )
    app.save(job)
  },
  (app) => {},
)
