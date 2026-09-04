migrate(
  (app) => {
    let settings = null
    try {
      const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
      if (sRecords && sRecords.length > 0) settings = sRecords[0]
    } catch (_) {}
    const accessToken = settings ? settings.getString('access_token') : ''

    const pRecord = app.findRecordById('products', '82b1k0m0l2hanr3')

    const putRes = $http.send({
      url: 'https://api.mercadolibre.com/items/MLB7590950114',
      method: 'PUT',
      headers: {
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        attributes: [
          { id: 'ITEM_CONDITION', value_id: '2230582' },
          { id: 'GRADING', value_id: '40108830' },
        ],
      }),
      timeout: 15,
    })

    // Também consultar o item T580 agora para ver como ficou
    const getRes = $http.send({
      url: 'https://api.mercadolibre.com/items/MLB7590950114',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + accessToken },
      timeout: 15,
    })

    let t580 = getRes.statusCode === 200 ? getRes.json : {}
    let cond = (t580.attributes || []).find((a) => a.id === 'ITEM_CONDITION')
    let grad = (t580.attributes || []).find((a) => a.id === 'GRADING')

    const summary = {
      put_status: putRes.statusCode,
      put_msg: putRes.json ? putRes.json.message || putRes.json.error || 'ok' : null,
      put_cause: putRes.json ? putRes.json.cause : null,
      root_cond: t580.condition,
      ITEM_COND: cond ? { id: cond.value_id, name: cond.value_name } : null,
      GRADING: grad ? { id: grad.value_id, name: grad.value_name } : null,
    }

    pRecord.set('bench_notes', JSON.stringify(summary).slice(0, 4900))
    app.save(pRecord)
  },
  (app) => {},
)
