migrate(
  (app) => {
    let token = ''
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (sRecords && sRecords.length > 0) {
      token = sRecords[0].getString('access_token')
    }

    const testUrl = 'https://api.mercadolibre.com/products/MLB26899510'
    const res = $http.send({
      url: testUrl,
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 10,
    })

    const p = res.json || {}
    console.log(
      '[PROBE_PRODUCT] id=' +
        p.id +
        ' sold_quantity=' +
        p.sold_quantity +
        ' sold_mp=' +
        p.sold_quantity_mercadopago +
        ' keys=' +
        Object.keys(p).join(','),
    )
  },
  (app) => {},
)
