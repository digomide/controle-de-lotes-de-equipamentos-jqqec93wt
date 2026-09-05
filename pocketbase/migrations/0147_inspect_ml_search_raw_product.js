migrate(
  (app) => {
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    const token = sRecords[0].getString('access_token')

    const res = $http.send({
      url: 'https://api.mercadolibre.com/products/search?status=active&site_id=MLB&domain_id=MLB-NOTEBOOKS&q=dell%20latitude%203420&limit=5&offset=0',
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/json',
      },
      timeout: 10,
    })

    let rawItem = null
    if (res.statusCode === 200 && res.json && res.json.results && res.json.results.length > 0) {
      const prod = res.json.results[0]
      // inspecionar atributos, buy_box_winner e campos do prod
      rawItem = {
        id: prod.id,
        name: prod.name,
        attributes: prod.attributes
          ? prod.attributes.map((a) => ({
              id: a.id,
              name: a.name,
              value_id: a.value_id,
              value_name: a.value_name,
            }))
          : [],
        buy_box_winner: prod.buy_box_winner,
        condition: prod.condition,
        status: prod.status,
      }
    }

    const job = app.findFirstRecordByData('ml_catalog_search_jobs', 'id', 'szg3o742i7qawmh')
    job.set(
      'error_message',
      JSON.stringify({
        status: res.statusCode,
        rawItem: rawItem,
      }),
    )
    app.save(job)
  },
  (app) => {},
)
