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
      // X1: condition: 'not_specified' pura (sem attributes)
      {
        name: 'X1_not_specified_pure',
        payload: Object.assign({}, basePayload, { condition: 'not_specified' }),
      },
      // X2: ITEM_CONDITION value_name: 'Caixa aberta' (sem value_id)
      {
        name: 'X2_openbox_name',
        payload: Object.assign({}, basePayload, {
          attributes: [{ id: 'ITEM_CONDITION', value_name: 'Caixa aberta' }],
        }),
      },
      // X3: ITEM_CONDITION value_name: 'Recondicionado' com ITEM_GRADE
      {
        name: 'X3_refurb_grade',
        payload: Object.assign({}, basePayload, {
          attributes: [
            { id: 'ITEM_CONDITION', value_id: '2230582' },
            { id: 'ITEM_GRADE', value_name: 'Excelente' },
          ],
        }),
      },
    ]

    const out = []
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
        out.push({
          name: exp.name,
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
        out.push({ name: exp.name, err: String(e) })
      }
    }

    const r = app.findFirstRecordByData('ml_catalog_publish_jobs', 'id', 'lo0rtbzlgq6a5el')
    r.set('error_message', JSON.stringify(out).substring(0, 4000))
    app.save(r)
  },
  (app) => {},
)
