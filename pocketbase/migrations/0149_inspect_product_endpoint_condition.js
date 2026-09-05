migrate(
  (app) => {
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    const token = sRecords[0].getString('access_token')

    // Consulta direta em /products/MLB37239539
    const res = $http.send({
      url: 'https://api.mercadolibre.com/products/MLB37239539',
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/json',
      },
      timeout: 10,
    })

    let details = null
    if (res.statusCode === 200 && res.json) {
      const p = res.json
      details = {
        id: p.id,
        name: p.name,
        buy_box_winner: p.buy_box_winner,
        condition: p.condition,
        status: p.status,
        attributes: (p.attributes || []).map((a) => ({
          id: a.id,
          value_id: a.value_id,
          value_name: a.value_name,
        })),
      }
    }

    const job = app.findFirstRecordByData('ml_catalog_search_jobs', 'id', 'szg3o742i7qawmh')
    job.set(
      'error_message',
      JSON.stringify({
        status: res.statusCode,
        details: details,
      }),
    )
    app.save(job)
  },
  (app) => {},
)
