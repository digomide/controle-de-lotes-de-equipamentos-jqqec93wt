migrate(
  (app) => {
    let settings = null
    try {
      const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
      if (sRecords && sRecords.length > 0) settings = sRecords[0]
    } catch (_) {}
    const accessToken = settings ? settings.getString('access_token') : ''

    // Pegar o último item da fila de publicação criado pela migration 0046
    const qRecords = app.findRecordsByFilter('ml_publish_queue', '1=1', '-created', 1, 0)
    const qRec = qRecords[0]

    // Base payload
    const basePayload = {
      category_id: 'MLB1652',
      price: 2800,
      currency_id: 'BRL',
      available_quantity: 1,
      buying_mode: 'buy_it_now',
      listing_type_id: 'gold_special',
      family_name: 'Lenovo ThinkPad ThinkPad T580',
      pictures: [
        {
          source:
            'https://ambicorpflow.replit.app/api/storage/objects/uploads/87f2bef6-24ba-48ad-8e69-48c6d17f7df9',
        },
      ],
      channels: ['marketplace'],
    }

    const baseAttrs = [
      { id: 'BRAND', value_name: 'Lenovo' },
      { id: 'MODEL', value_name: 'ThinkPad T580' },
      { id: 'LINE', value_name: 'ThinkPad' },
      { id: 'PROCESSOR_BRAND', value_name: 'Intel' },
      { id: 'PROCESSOR_LINE', value_name: 'Core i7' },
      { id: 'PROCESSOR_MODEL', value_name: '8550U' },
      { id: 'DISPLAY_SIZE', value_name: '15.6 "' },
      { id: 'GTIN', value_name: '4015701100344' },
    ]

    // Testar 1: condition: "not_specified", ITEM_CONDITION 2230582, GRADING 40108830
    // Testar 2: condition: "used", ITEM_CONDITION 2230582, GRADING 40108830
    // Testar 3: condition: "new", ITEM_CONDITION 2230582, GRADING 40108830
    const variationsToTest = [
      {
        name: 'not_specified+recond+excelente',
        body: Object.assign({}, basePayload, {
          condition: 'not_specified',
          attributes: baseAttrs.concat([
            { id: 'ITEM_CONDITION', value_id: '2230582', value_name: 'Recondicionado' },
            { id: 'GRADING', value_id: '40108830', value_name: 'Excelente' },
          ]),
        }),
      },
      {
        name: 'used+recond+excelente',
        body: Object.assign({}, basePayload, {
          condition: 'used',
          attributes: baseAttrs.concat([
            { id: 'ITEM_CONDITION', value_id: '2230582', value_name: 'Recondicionado' },
            { id: 'GRADING', value_id: '40108830', value_name: 'Excelente' },
          ]),
        }),
      },
      {
        name: 'new+recond+excelente',
        body: Object.assign({}, basePayload, {
          condition: 'new',
          attributes: baseAttrs.concat([
            { id: 'ITEM_CONDITION', value_id: '2230582', value_name: 'Recondicionado' },
            { id: 'GRADING', value_id: '40108830', value_name: 'Excelente' },
          ]),
        }),
      },
    ]

    let results = []
    for (let i = 0; i < variationsToTest.length; i++) {
      const v = variationsToTest[i]
      let res = null
      try {
        res = $http.send({
          url: 'https://api.mercadolibre.com/items/validate',
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + accessToken,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(v.body),
          timeout: 20,
        })
      } catch (e) {
        res = { statusCode: 500, json: { err: String(e) } }
      }
      const respBody = res.json || {}
      let errCode = ''
      if (respBody.cause && respBody.cause[0]) {
        errCode =
          respBody.cause[0].code || respBody.cause[0].message || JSON.stringify(respBody.cause[0])
      }
      results.push(v.name + ': ' + res.statusCode + (errCode ? ' (' + errCode + ')' : ''))
    }

    qRec.set('error_message', results.join(' | '))
    app.save(qRec)
  },
  (app) => {},
)
