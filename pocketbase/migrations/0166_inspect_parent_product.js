migrate(
  (app) => {
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    const token = sRecords[0].getString('access_token')

    // Consultar parent MLB37239538
    const res = $http.send({
      url: 'https://api.mercadolibre.com/products/MLB37239538',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 10,
    })

    let parentData = null
    if (res.statusCode === 200 && res.json) {
      const pj = res.json
      parentData = {
        id: pj.id,
        name: pj.name,
        children_ids: pj.children_ids,
        buy_box_winner: pj.buy_box_winner,
        attributes: (pj.attributes || []).map((a) => a.id + '=' + a.value_name).slice(0, 10),
      }
    }

    const job = app.findFirstRecordByData('ml_catalog_search_jobs', 'id', 'szg3o742i7qawmh')
    job.set(
      'error_message',
      JSON.stringify({
        parentStatusCode: res.statusCode,
        parentData: parentData,
      }),
    )
    app.save(job)
  },
  (app) => {},
)
