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

    // Pegar item Dell
    const itemDellRes = $http.send({
      url: 'https://api.mercadolibre.com/items/MLB7591024470',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + accessToken },
      timeout: 15,
    })

    const t580 = itemRes.json || {}
    const dell = itemDellRes.json || {}

    const t580Cond = (t580.attributes || []).find((a) => a.id === 'ITEM_CONDITION')
    const t580Grad = (t580.attributes || []).find((a) => a.id === 'GRADING')

    const dellCond = (dell.attributes || []).find((a) => a.id === 'ITEM_CONDITION')
    const dellGrad = (dell.attributes || []).find((a) => a.id === 'GRADING')

    // Salvar no error_message do registro da fila do T580
    const qRecs = app.findRecordsByFilter(
      'ml_publish_queue',
      'product = "82b1k0m0l2hanr3"',
      '-created',
      1,
      0,
    )
    if (qRecs.length > 0) {
      const q = qRecs[0]
      const info =
        'T580: root=' +
        t580.condition +
        ', cond=' +
        (t580Cond ? t580Cond.value_name : 'null') +
        ', grad=' +
        (t580Grad ? t580Grad.value_name : 'null') +
        ' | DELL: root=' +
        dell.condition +
        ', cond=' +
        (dellCond ? dellCond.value_name : 'null') +
        ', grad=' +
        (dellGrad ? dellGrad.value_name : 'null')
      q.set('error_message', info)
      app.save(q)
    }
  },
  (app) => {},
)
