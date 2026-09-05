migrate(
  (app) => {
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    const token = sRecords[0].getString('access_token')

    const res = $http.send({
      url: 'https://api.mercadolibre.com/products/MLB37239539',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 10,
    })

    let allKeys = []
    let attributes = []
    if (res.statusCode === 200 && res.json) {
      allKeys = Object.keys(res.json)
      if (Array.isArray(res.json.attributes)) {
        attributes = res.json.attributes.map((a) => a.id + '=' + a.value_name)
      }
    }

    const job = app.findFirstRecordByData('ml_catalog_search_jobs', 'id', 'szg3o742i7qawmh')
    job.set(
      'error_message',
      JSON.stringify({
        allKeys: allKeys,
        attrCount: attributes.length,
        attrs: attributes.slice(0, 30),
      }),
    )
    app.save(job)
  },
  (app) => {},
)
