migrate(
  (app) => {
    let token = ''
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (sRecords && sRecords.length > 0) {
      token = sRecords[0].getString('access_token')
    }

    const ownItemId = 'MLB5193015165'
    const ownRes = $http.send({
      url:
        'https://api.mercadolibre.com/items/' +
        ownItemId +
        '?attributes=id,sold_quantity,available_quantity,price,title',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 10,
    })

    const ownMulti = $http.send({
      url:
        'https://api.mercadolibre.com/items?ids=' +
        ownItemId +
        '&attributes=id,sold_quantity,available_quantity,price,title',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 10,
    })

    const job = app.findRecordById('ml_competitor_jobs', 'wp8elpqepb1vao9')
    job.set(
      'error_message',
      'ownRes: ' + JSON.stringify(ownRes.json) + ' | ownMulti: ' + JSON.stringify(ownMulti.json),
    )
    app.save(job)
  },
  (app) => {},
)
