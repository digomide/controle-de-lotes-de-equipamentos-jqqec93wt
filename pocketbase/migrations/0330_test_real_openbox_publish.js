migrate(
  (app) => {
    const settingsList = app.findRecordsByFilter('ml_settings', '', '-created', 1, 0)
    if (!settingsList || settingsList.length === 0) return
    const s = settingsList[0]
    let token = s.getString('access_token')

    const payloadOpenBox = {
      catalog_product_id: 'MLB50747892',
      catalog_listing: true,
      category_id: 'MLB1652',
      price: 1500,
      currency_id: 'BRL',
      available_quantity: 1,
      buying_mode: 'buy_it_now',
      listing_type_id: 'gold_special',
      attributes: [
        { id: 'ITEM_CONDITION', value_id: '46759135' }, // Caixa aberta
      ],
      shipping: { mode: 'me2', local_pick_up: true, free_shipping: true },
      sale_terms: [
        { id: 'WARRANTY_TYPE', value_name: 'Garantia do vendedor' },
        { id: 'WARRANTY_TIME', value_name: '90 dias' },
      ],
    }

    let createdId = ''
    let resStatus = 0
    let resBody = null
    try {
      const res = $http.send({
        url: 'https://api.mercadolibre.com/items',
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payloadOpenBox),
        timeout: 20,
      })
      resStatus = res.statusCode
      resBody = res.json

      if (res.statusCode === 200 || res.statusCode === 201) {
        createdId = res.json?.id || ''
        // Pausar/fechar imediatamente se foi criado!
        if (createdId) {
          try {
            $http.send({
              url: 'https://api.mercadolibre.com/items/' + createdId,
              method: 'PUT',
              headers: {
                Authorization: 'Bearer ' + token,
                'Content-Type': 'application/json',
                Accept: 'application/json',
              },
              body: JSON.stringify({ status: 'closed' }),
              timeout: 10,
            })
          } catch (_) {}
        }
      }
    } catch (err) {
      resBody = { err: String(err) }
    }

    // Salvar resumo no job lo0rtbzlgq6a5el se existir
    try {
      const r = app.findFirstRecordByData('ml_catalog_publish_jobs', 'id', 'lo0rtbzlgq6a5el')
      if (r) {
        const snippet = JSON.stringify(resBody || {}).slice(0, 1000)
        r.set(
          'error_message',
          ('POST_OPEN_BOX status:' + resStatus + ' id:' + createdId + ' body:' + snippet).slice(
            0,
            4500,
          ),
        )
        app.save(r)
      }
    } catch (_) {}

    // PAUSAR/FECHAR ANÚNCIOS DE TESTE CRIADOS NA CONTA INFOPRECOBAIXO
    const testMlbIds = [
      'MLB7594728102',
      'MLB5192815467',
      'MLB5192815461',
      'MLB5192802335',
      'MLB5192802329',
      'MLB7594728080',
      'MLB5192815431',
      'MLB7594728074',
      'MLB5192802307',
      'MLB5192815407',
      'MLB5192815401',
      'MLB5192815395',
      'MLB7594728058',
      'MLB5192802287',
      'MLB5192802279',
      'MLB5192815375',
      'MLB5192815015',
      'MLB5192815351',
      'MLB7594728012',
      'MLB7594728022',
      'MLB5192802255',
      'MLB7594728032',
      'MLB7594728038',
      'MLB5192815371',
    ]

    for (let i = 0; i < testMlbIds.length; i++) {
      const mlb = testMlbIds[i]
      try {
        $http.send({
          url: 'https://api.mercadolibre.com/items/' + mlb,
          method: 'PUT',
          headers: {
            Authorization: 'Bearer ' + token,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ status: 'paused' }),
          timeout: 10,
        })
      } catch (_) {}
    }
  },
  (app) => {},
)
