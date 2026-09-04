migrate(
  (app) => {
    let settings = null
    try {
      const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
      if (sRecords && sRecords.length > 0) settings = sRecords[0]
    } catch (_) {}
    const accessToken = settings ? settings.getString('access_token') : ''

    // Pegar item T580
    const itemRes = $http.send({
      url: 'https://api.mercadolibre.com/items/MLB7590950114',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + accessToken },
      timeout: 15,
    })

    let t580 = itemRes.statusCode === 200 ? itemRes.json : {}
    let cond = (t580.attributes || []).find((a) => a.id === 'ITEM_CONDITION')
    let grad = (t580.attributes || []).find((a) => a.id === 'GRADING')

    const pRecord = app.findRecordById('products', '82b1k0m0l2hanr3')
    pRecord.set(
      'description',
      'T580_STATUS: root=' +
        t580.condition +
        ' | ITEM_COND=' +
        (cond ? cond.value_name : 'null') +
        ' | GRADING=' +
        (grad ? grad.value_name : 'null'),
    )
    app.save(pRecord)
  },
  (app) => {},
)
