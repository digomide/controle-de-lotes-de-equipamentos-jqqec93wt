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

    const testRuns = [
      // R1: condition: 'not_specified' + attributes ITEM_CONDITION: 2230582 (Recondicionado)
      {
        name: 'R1_not_specified_and_attr_recondicionado',
        payload: Object.assign({}, basePayload, {
          condition: 'not_specified',
          attributes: [{ id: 'ITEM_CONDITION', value_id: '2230582' }],
        }),
      },
      // R2: condition: 'new' + attributes ITEM_CONDITION: 2230582 (Recondicionado)
      {
        name: 'R2_new_and_attr_recondicionado',
        payload: Object.assign({}, basePayload, {
          condition: 'new',
          attributes: [{ id: 'ITEM_CONDITION', value_id: '2230582' }],
        }),
      },
      // R3: condition: 'refurbished' com category_id: null (sem category_id no payload, deixando o catálogo inferir)
      {
        name: 'R3_refurbished_without_category_id',
        payload: {
          catalog_product_id: 'MLB50747892',
          catalog_listing: true,
          price: 1500,
          currency_id: 'BRL',
          available_quantity: 1,
          buying_mode: 'buy_it_now',
          listing_type_id: 'gold_special',
          condition: 'refurbished',
          shipping: { mode: 'me2', local_pick_up: true, free_shipping: true },
          sale_terms: [
            { id: 'WARRANTY_TYPE', value_name: 'Garantia do vendedor' },
            { id: 'WARRANTY_TIME', value_name: '90 dias' },
          ],
        },
      },
      // R4: attributes ITEM_CONDITION: 2230582 SEM category_id
      {
        name: 'R4_attr_recondicionado_without_category_id',
        payload: {
          catalog_product_id: 'MLB50747892',
          catalog_listing: true,
          price: 1500,
          currency_id: 'BRL',
          available_quantity: 1,
          buying_mode: 'buy_it_now',
          listing_type_id: 'gold_special',
          attributes: [{ id: 'ITEM_CONDITION', value_id: '2230582' }],
          shipping: { mode: 'me2', local_pick_up: true, free_shipping: true },
          sale_terms: [
            { id: 'WARRANTY_TYPE', value_name: 'Garantia do vendedor' },
            { id: 'WARRANTY_TIME', value_name: '90 dias' },
          ],
        },
      },
    ]

    const out = []
    for (let i = 0; i < testRuns.length; i++) {
      const tr = testRuns[i]
      try {
        const res = $http.send({
          url: 'https://api.mercadolibre.com/items/validate',
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + token,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(tr.payload),
          timeout: 15,
        })
        out.push({
          name: tr.name,
          status: res.statusCode,
          error: res.json?.error,
          message: res.json?.message,
          causes: (res.json?.cause || []).map((c) => ({
            code: c.code,
            msg: c.message,
            ref: c.references,
            type: c.type,
          })),
        })
      } catch (e) {
        out.push({ name: tr.name, err: String(e) })
      }
    }

    const r = app.findFirstRecordByData('ml_catalog_publish_jobs', 'id', 'lo0rtbzlgq6a5el')
    r.set('error_message', JSON.stringify(out).substring(0, 4000))
    app.save(r)
  },
  (app) => {},
)
