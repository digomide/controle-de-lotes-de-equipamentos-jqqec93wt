migrate(
  (app) => {
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    const token = sRecords[0].getString('access_token')

    // Buscar itens ativos por query no site
    const sRes = $http.send({
      url: 'https://api.mercadolibre.com/sites/MLB/search?q=dell%20latitude%203420&limit=5',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 10,
    })

    let catalogListed = []
    if (sRes.statusCode === 200 && sRes.json && sRes.json.results) {
      for (let i = 0; i < sRes.json.results.length; i++) {
        const it = sRes.json.results[i]
        catalogListed.push({
          id: it.id,
          title: it.title,
          price: it.price,
          catalog_listing: it.catalog_listing,
          catalog_product_id: it.catalog_product_id,
          condition: it.condition,
          available_quantity: it.available_quantity,
          sold_quantity: it.sold_quantity,
          seller: it.seller,
        })
      }
    }

    const job = app.findFirstRecordByData('ml_catalog_search_jobs', 'id', 'szg3o742i7qawmh')
    job.set(
      'error_message',
      JSON.stringify({
        status: sRes.statusCode,
        catalogListed: catalogListed,
      }),
    )
    app.save(job)
  },
  (app) => {},
)
