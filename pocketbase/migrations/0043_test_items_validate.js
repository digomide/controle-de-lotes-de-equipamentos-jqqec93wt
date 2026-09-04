migrate(
  (app) => {
    let settings = null
    try {
      const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
      if (sRecords && sRecords.length > 0) settings = sRecords[0]
    } catch (_) {}
    const accessToken = settings ? settings.getString('access_token') : ''

    // Testar 1: POST /items com condition "new" + ITEM_CONDITION 2230582 + GRADING 40108830
    // Testar 2: POST /items com condition "not_specified" + ITEM_CONDITION 2230582 + GRADING 40108830
    // Testar 3: POST /items com condition "used" + ITEM_CONDITION 2230582 + GRADING 40108830
    // Como não queremos criar um anúncio ativo à toa a menos que seja um teste, vamos testar primeiro o que o ML valida:
    // O Mercado Livre tem o endpoint POST /items/validate (ou validation) para validar payloads sem criar!
    // Vamos testar POST /items/validate com diferentes payloads:
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

    const tests = [
      {
        name: "T1: root 'new' + ITEM_CONDITION 2230582 (Recondicionado) + GRADING 40108830 (Excelente)",
        payload: Object.assign({}, basePayload, {
          condition: 'new',
          attributes: baseAttrs.concat([
            { id: 'ITEM_CONDITION', value_id: '2230582', value_name: 'Recondicionado' },
            { id: 'GRADING', value_id: '40108830', value_name: 'Excelente' },
          ]),
        }),
      },
      {
        name: "T2: root 'used' + ITEM_CONDITION 2230582 (Recondicionado) + GRADING 40108830 (Excelente)",
        payload: Object.assign({}, basePayload, {
          condition: 'used',
          attributes: baseAttrs.concat([
            { id: 'ITEM_CONDITION', value_id: '2230582', value_name: 'Recondicionado' },
            { id: 'GRADING', value_id: '40108830', value_name: 'Excelente' },
          ]),
        }),
      },
      {
        name: "T3: root 'not_specified' + ITEM_CONDITION 2230582 + GRADING 40108830",
        payload: Object.assign({}, basePayload, {
          condition: 'not_specified',
          attributes: baseAttrs.concat([
            { id: 'ITEM_CONDITION', value_id: '2230582', value_name: 'Recondicionado' },
            { id: 'GRADING', value_id: '40108830', value_name: 'Excelente' },
          ]),
        }),
      },
      {
        name: "T4: root 'new' + sem ITEM_CONDITION attr + apenas GRADING 40108830",
        payload: Object.assign({}, basePayload, {
          condition: 'new',
          attributes: baseAttrs.concat([
            { id: 'GRADING', value_id: '40108830', value_name: 'Excelente' },
          ]),
        }),
      },
    ]

    const results = []
    for (let i = 0; i < tests.length; i++) {
      const t = tests[i]
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
          body: JSON.stringify(t.payload),
          timeout: 20,
        })
      } catch (e) {
        res = { statusCode: 500, json: { err: String(e) } }
      }
      results.push({
        test: t.name,
        status: res.statusCode,
        body: res.json,
      })
    }

    const pRecord = app.findRecordById('products', '82b1k0m0l2hanr3')
    pRecord.set('bench_notes', JSON.stringify(results).slice(0, 4900))
    app.save(pRecord)
  },
  (app) => {},
)
