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
      // P1: Caixa aberta SEM root condition
      {
        name: 'P1_caixa_aberta_attr_only',
        payload: Object.assign({}, basePayload, {
          attributes: [{ id: 'ITEM_CONDITION', value_id: '46759135' }],
        }),
      },
      // P2: Caixa aberta COM root condition 'used'
      {
        name: 'P2_caixa_aberta_root_used',
        payload: Object.assign({}, basePayload, {
          condition: 'used',
          attributes: [{ id: 'ITEM_CONDITION', value_id: '46759135' }],
        }),
      },
      // P3: Usado com attribute ITEM_CONDITION Usado (2230581)
      {
        name: 'P3_used_attr_used',
        payload: Object.assign({}, basePayload, {
          condition: 'used',
          attributes: [{ id: 'ITEM_CONDITION', value_id: '2230581' }],
        }),
      },
      // P4: Usado puro
      {
        name: 'P4_used_pure',
        payload: Object.assign({}, basePayload, {
          condition: 'used',
        }),
      },
      // P5: Novo puro
      {
        name: 'P5_new_pure',
        payload: Object.assign({}, basePayload, {
          condition: 'new',
        }),
      },
      // P6: Recondicionado com ITEM_GRADE ou similar?
      // O que mais o ML aceita para refurbished?
      {
        name: 'P6_not_specified_pure',
        payload: Object.assign({}, basePayload, {
          condition: 'not_specified',
        }),
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
