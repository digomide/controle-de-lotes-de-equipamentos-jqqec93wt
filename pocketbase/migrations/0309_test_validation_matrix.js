migrate(
  (app) => {
    const settingsList = app.findRecordsByFilter('ml_settings', '', '-created', 1, 0)
    if (!settingsList || settingsList.length === 0) return
    const s = settingsList[0]
    let token = s.getString('access_token')

    const basePayload = {
      catalog_product_id: 'MLB50747892',
      catalog_listing: true,
      category_id: 'MLB1652',
      price: 1500,
      currency_id: 'BRL',
      available_quantity: 1,
      buying_mode: 'buy_it_now',
      listing_type_id: 'gold_special',
      shipping: { mode: 'me2', local_pick_up: true, free_shipping: true },
      sale_terms: [
        { id: 'WARRANTY_TYPE', value_name: 'Garantia do vendedor' },
        { id: 'WARRANTY_TIME', value_name: '90 dias' },
      ],
    }

    const tests = [
      // Test 1: SEM root condition, apenas ITEM_CONDITION attribute = 2230582 (Recondicionado)
      {
        name: 'T1_no_root_cond_attr_recondicionado',
        payload: Object.assign({}, basePayload, {
          attributes: [{ id: 'ITEM_CONDITION', value_id: '2230582' }],
        }),
      },
      // Test 2: SEM root condition, apenas ITEM_CONDITION attribute = 46759135 (Caixa aberta)
      {
        name: 'T2_no_root_cond_attr_caixa_aberta',
        payload: Object.assign({}, basePayload, {
          attributes: [{ id: 'ITEM_CONDITION', value_id: '46759135' }],
        }),
      },
      // Test 3: root condition: 'not_specified' + ITEM_CONDITION attribute 2230582
      {
        name: 'T3_root_not_specified_attr_recondicionado',
        payload: Object.assign({}, basePayload, {
          condition: 'not_specified',
          attributes: [{ id: 'ITEM_CONDITION', value_id: '2230582' }],
        }),
      },
      // Test 4: root condition: 'not_specified' + ITEM_CONDITION attribute 46759135
      {
        name: 'T4_root_not_specified_attr_caixa_aberta',
        payload: Object.assign({}, basePayload, {
          condition: 'not_specified',
          attributes: [{ id: 'ITEM_CONDITION', value_id: '46759135' }],
        }),
      },
      // Test 5: root condition: 'used' e sem attributes (baseline de sucesso para comparar)
      {
        name: 'T5_root_used_baseline',
        payload: Object.assign({}, basePayload, {
          condition: 'used',
        }),
      },
      // Test 6: root condition: 'new' e sem attributes (baseline novo)
      {
        name: 'T6_root_new_baseline',
        payload: Object.assign({}, basePayload, {
          condition: 'new',
        }),
      },
    ]

    const results = {}

    for (let i = 0; i < tests.length; i++) {
      const t = tests[i]
      try {
        const res = $http.send({
          url: 'https://api.mercadolibre.com/items/validate',
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + token,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(t.payload),
          timeout: 15,
        })
        results[t.name] = {
          status: res.statusCode,
          error: res.json?.error,
          message: res.json?.message,
          cause: res.json?.cause,
        }
      } catch (err) {
        results[t.name] = { err: String(err) }
      }
    }

    const r = app.findFirstRecordByData('ml_catalog_publish_jobs', 'id', 'uc82hebcvxq2og7')
    r.set('error_message', JSON.stringify(results))
    app.save(r)
  },
  (app) => {},
)
