migrate(
  (app) => {
    // Buscar um registro que não esteja sendo usado para visualização
    const r = app.findFirstRecordByData('ml_catalog_publish_jobs', 'id', 'lo0rtbzlgq6a5el')
    if (!r) return

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

    const testPayloads = [
      {
        name: 'E1_open_box_attr_no_root',
        payload: Object.assign({}, basePayload, {
          attributes: [{ id: 'ITEM_CONDITION', value_id: '46759135' }],
        }),
      },
      { name: 'E2_used_puro', payload: Object.assign({}, basePayload, { condition: 'used' }) },
      { name: 'E3_new_puro', payload: Object.assign({}, basePayload, { condition: 'new' }) },
    ]

    let results = []
    for (let i = 0; i < testPayloads.length; i++) {
      const tp = testPayloads[i]
      try {
        const res = $http.send({
          url: 'https://api.mercadolibre.com/items/validate',
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + token,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(tp.payload),
          timeout: 15,
        })
        results.push(tp.name + ' => status ' + res.statusCode + ': ' + JSON.stringify(res.json))
      } catch (err) {
        results.push(tp.name + ' => err: ' + String(err))
      }
    }

    r.set('error_message', results.join(' \n||| '))
    app.save(r)
  },
  (app) => {},
)
