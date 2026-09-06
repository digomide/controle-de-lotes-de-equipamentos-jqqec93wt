migrate(
  (app) => {
    // Obter token ML
    const settingsList = app.findRecordsByFilter('ml_settings', '', '-created', 1, 0)
    if (!settingsList || settingsList.length === 0) return
    const s = settingsList[0]
    let token = s.getString('access_token')

    // 1. Inspecionar /products/MLB50747892
    let prodData = {}
    try {
      const resProd = $http.send({
        url: 'https://api.mercadolibre.com/products/MLB50747892',
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + token,
          Accept: 'application/json',
        },
        timeout: 15,
      })
      prodData = {
        status: resProd.statusCode,
        name: resProd.json?.name,
        category_id: resProd.json?.category_id,
        domain_id: resProd.json?.domain_id,
        condition: resProd.json?.condition,
        attributes: (resProd.json?.attributes || []).map((a) => ({
          id: a.id,
          name: a.name,
          value_name: a.value_name,
          value_id: a.value_id,
        })),
      }
    } catch (eProd) {
      prodData = { error: String(eProd) }
    }

    // 2. Inspecionar atributos da categoria MLB1652 com foco em ITEM_CONDITION
    let categoryAttrs = []
    try {
      const resCat = $http.send({
        url: 'https://api.mercadolibre.com/categories/MLB1652/attributes',
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + token,
          Accept: 'application/json',
        },
        timeout: 15,
      })
      if (resCat.statusCode === 200 && Array.isArray(resCat.json)) {
        categoryAttrs = resCat.json
          .filter(
            (a) =>
              a.id &&
              (a.id.indexOf('CONDIT') >= 0 ||
                a.id.indexOf('GRADE') >= 0 ||
                a.id.indexOf('BOX') >= 0),
          )
          .map((a) => ({
            id: a.id,
            name: a.name,
            values: (a.values || []).map((v) => ({ id: v.id, name: v.name })),
          }))
      }
    } catch (eCat) {
      categoryAttrs = [{ error: String(eCat) }]
    }

    // 3. Testar validação com diferentes variações de payload para MLB50747892
    // Teste A: condition: 'refurbished' puro
    const payloadA = {
      catalog_product_id: 'MLB50747892',
      catalog_listing: true,
      category_id: 'MLB1652',
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
    }

    let validateA = {}
    try {
      const resA = $http.send({
        url: 'https://api.mercadolibre.com/items/validate',
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payloadA),
        timeout: 15,
      })
      validateA = { status: resA.statusCode, json: resA.json }
    } catch (eA) {
      validateA = { error: String(eA) }
    }

    // Teste B: condition: 'used' + ITEM_CONDITION attribute
    const payloadB = {
      catalog_product_id: 'MLB50747892',
      catalog_listing: true,
      category_id: 'MLB1652',
      price: 1500,
      currency_id: 'BRL',
      available_quantity: 1,
      buying_mode: 'buy_it_now',
      listing_type_id: 'gold_special',
      condition: 'used',
      attributes: [{ id: 'ITEM_CONDITION', value_name: 'Recondicionado' }],
      shipping: { mode: 'me2', local_pick_up: true, free_shipping: true },
      sale_terms: [
        { id: 'WARRANTY_TYPE', value_name: 'Garantia do vendedor' },
        { id: 'WARRANTY_TIME', value_name: '90 dias' },
      ],
    }

    let validateB = {}
    try {
      const resB = $http.send({
        url: 'https://api.mercadolibre.com/items/validate',
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payloadB),
        timeout: 15,
      })
      validateB = { status: resB.statusCode, json: resB.json }
    } catch (eB) {
      validateB = { error: String(eB) }
    }

    // Salvar diagnóstico no registro ml_settings.site_id ou num registro de publish jobs existente
    const rJobs = app.findRecordsByFilter('ml_catalog_publish_jobs', '', '-created', 1, 0)
    if (rJobs && rJobs.length > 0) {
      const j = rJobs[0]
      j.set('result_data', {
        prodData: prodData,
        categoryAttrs: categoryAttrs,
        validateA: validateA,
        validateB: validateB,
      })
      app.save(j)
    }
  },
  (app) => {},
)
