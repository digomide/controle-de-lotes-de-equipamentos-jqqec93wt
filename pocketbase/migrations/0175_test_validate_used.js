migrate(
  (app) => {
    // Obter token
    const settingsList = app.findRecordsByFilter('ml_settings', '', '-created', 1, 0)
    if (!settingsList || settingsList.length === 0) return
    const s = settingsList[0]
    const token = s.getString('access_token')

    // Testar /items/validate com catalog_product_id: MLB75369005 e condition: used
    const payloadUsed = {
      catalog_product_id: 'MLB75369005',
      catalog_listing: true,
      category_id: 'MLB1652',
      price: 1200,
      currency_id: 'BRL',
      available_quantity: 1,
      buying_mode: 'buy_it_now',
      listing_type_id: 'gold_special',
      condition: 'used',
      sale_terms: [
        { id: 'WARRANTY_TYPE', value_name: 'Garantia do vendedor' },
        { id: 'WARRANTY_TIME', value_name: '90 dias' },
      ],
      shipping: {
        mode: 'me2',
        local_pick_up: true,
        free_shipping: true,
      },
    }

    let resText = ''
    try {
      const res = $http.send({
        url: 'https://api.mercadolibre.com/items/validate',
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payloadUsed),
        timeout: 15,
      })
      resText = 'VALIDATE_USED: status ' + res.statusCode + ' body: ' + JSON.stringify(res.json)
    } catch (e) {
      resText = 'ERR: ' + e.message
    }

    const r1 = app.findFirstRecordByData('ml_catalog_publish_jobs', 'id', 'ekv6wnr3kc24msq')
    r1.set('error_message', resText.substring(0, 500))
    app.save(r1)
  },
  (app) => {},
)
