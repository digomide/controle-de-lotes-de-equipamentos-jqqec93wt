migrate(
  (app) => {
    let token = ''
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (sRecords && sRecords.length > 0) {
      token = sRecords[0].getString('access_token')
    }

    const itId = 'MLB5318790794'
    const wRes = $http.send({
      url:
        'https://api.mercadolibre.com/items/' +
        itId +
        '?attributes=id,sold_quantity,sold_quantity_mercadopago,available_quantity,price,title',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 10,
    })

    const pRes = $http.send({
      url: 'https://api.mercadolibre.com/products/MLB26899510',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 10,
    })

    const job = app.findRecordById('ml_competitor_jobs', 'wp8elpqepb1vao9')
    job.set(
      'error_message',
      'item: ' +
        JSON.stringify(wRes.json) +
        ' | prod_sold_quantity: ' +
        (pRes.json ? pRes.json.sold_quantity : 'null') +
        ' | prod_bb: ' +
        JSON.stringify(pRes.json ? pRes.json.buy_box_winner : null),
    )
    app.save(job)
  },
  (app) => {},
)
