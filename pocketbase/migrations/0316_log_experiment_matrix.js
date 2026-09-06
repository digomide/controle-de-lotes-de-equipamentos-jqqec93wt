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

    const experiments = [
      // E1: root condition: 'not_specified' + ITEM_CONDITION 2230582 (Recondicionado)
      {
        name: 'E1_not_specified_recondicionado',
        payload: Object.assign({}, basePayload, {
          condition: 'not_specified',
          attributes: [{ id: 'ITEM_CONDITION', value_id: '2230582' }],
        }),
      },
      // E2: root condition: 'used' + ITEM_CONDITION 2230582
      {
        name: 'E2_used_recondicionado',
        payload: Object.assign({}, basePayload, {
          condition: 'used',
          attributes: [{ id: 'ITEM_CONDITION', value_id: '2230582' }],
        }),
      },
      // E3: root condition: 'used' + ITEM_CONDITION 46759135 (Caixa aberta)
      {
        name: 'E3_used_caixa_aberta',
        payload: Object.assign({}, basePayload, {
          condition: 'used',
          attributes: [{ id: 'ITEM_CONDITION', value_id: '46759135' }],
        }),
      },
      // E4: root condition: 'new' + ITEM_CONDITION 46759135 (Caixa aberta)
      {
        name: 'E4_new_caixa_aberta',
        payload: Object.assign({}, basePayload, {
          condition: 'new',
          attributes: [{ id: 'ITEM_CONDITION', value_id: '46759135' }],
        }),
      },
      // E5: root condition: 'refurbished' SEM attributes
      {
        name: 'E5_refurbished_sem_attr',
        payload: Object.assign({}, basePayload, {
          condition: 'refurbished',
        }),
      },
      // E6: root condition: 'refurbished' COM attributes ITEM_CONDITION 2230582
      {
        name: 'E6_refurbished_com_attr',
        payload: Object.assign({}, basePayload, {
          condition: 'refurbished',
          attributes: [{ id: 'ITEM_CONDITION', value_id: '2230582' }],
        }),
      },
      // E7: root condition: 'used' puro (sem attr)
      {
        name: 'E7_used_puro',
        payload: Object.assign({}, basePayload, {
          condition: 'used',
        }),
      },
      // E8: root condition: 'new' puro (sem attr)
      {
        name: 'E8_new_puro',
        payload: Object.assign({}, basePayload, {
          condition: 'new',
        }),
      },
    ]

    for (let i = 0; i < experiments.length; i++) {
      const exp = experiments[i]
      try {
        const res = $http.send({
          url: 'https://api.mercadolibre.com/items/validate',
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + token,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(exp.payload),
          timeout: 15,
        })
        console.log(
          '[EXP_RESULT] ' +
            exp.name +
            ' => status: ' +
            res.statusCode +
            ' body: ' +
            JSON.stringify(res.json),
        )
      } catch (err) {
        console.log('[EXP_RESULT] ' + exp.name + ' => error: ' + String(err))
      }
    }
  },
  (app) => {},
)
