migrate(
  (app) => {
    let token = ''
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (sRecords && sRecords.length > 0) {
      token = sRecords[0].getString('access_token')
    }

    const itId = 'MLB5318790794'
    const resNoAuth = $http.send({
      url:
        'https://api.mercadolibre.com/items/' +
        itId +
        '?attributes=id,sold_quantity,sold_quantity_mercadopago,available_quantity,price,title',
      method: 'GET',
      headers: { Accept: 'application/json' },
      timeout: 10,
    })

    // multiget com token
    const resMultigetWithToken = $http.send({
      url:
        'https://api.mercadolibre.com/items?ids=' +
        itId +
        '&attributes=id,sold_quantity,sold_quantity_mercadopago,available_quantity,price,title',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 10,
    })

    // multiget sem token
    const resMultigetNoAuth = $http.send({
      url:
        'https://api.mercadolibre.com/items?ids=' +
        itId +
        '&attributes=id,sold_quantity,sold_quantity_mercadopago,available_quantity,price,title',
      method: 'GET',
      headers: { Accept: 'application/json' },
      timeout: 10,
    })

    const job = app.findRecordById('ml_competitor_jobs', 'wp8elpqepb1vao9')
    job.set(
      'error_message',
      'noAuth: ' +
        JSON.stringify(resNoAuth.json) +
        ' | multiWithToken: ' +
        JSON.stringify(resMultigetWithToken.json) +
        ' | multiNoAuth: ' +
        JSON.stringify(resMultigetNoAuth.json),
    )
    app.save(job)
  },
  (app) => {},
)
