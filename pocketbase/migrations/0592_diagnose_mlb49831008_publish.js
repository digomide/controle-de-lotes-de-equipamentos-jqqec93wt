/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 0592_diagnose_mlb49831008_publish:
    // Diagnosticar por que MLB49831008 recebeu 403 PolicyAgent no POST /items
    const s = app.findFirstRecordByFilter('ml_settings', 'tenant_id = "ambicorpmestre1"')
    if (!s) {
      console.log('[0592_diag] ml_settings não encontrado')
      return
    }

    const token = s.getString('access_token')
    const catalogProductId = 'MLB49831008'

    // 1. GET /products/MLB49831008
    let catProd = null
    try {
      const pRes = $http.send({
        url: 'https://api.mercadolibre.com/products/' + catalogProductId,
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + token,
          Accept: 'application/json',
        },
        timeout: 15,
      })
      console.log('[0592_diag] GET /products/' + catalogProductId + ' status: ' + pRes.statusCode)
      if (pRes.statusCode === 200 && pRes.json) {
        catProd = pRes.json
        console.log(
          '[0592_diag] Categoria: ' +
            catProd.category_id +
            ', domain: ' +
            catProd.domain_id +
            ', name: ' +
            catProd.name +
            ', status: ' +
            catProd.status,
        )
      } else {
        console.log('[0592_diag] GET /products erro body: ' + pRes.raw)
      }
    } catch (e1) {
      console.log('[0592_diag] Erro GET product: ' + e1)
    }

    // 2. GET /categories/{category_id} para saber se aceita gold_special, etc.
    if (catProd && catProd.category_id) {
      try {
        const cRes = $http.send({
          url: 'https://api.mercadolibre.com/categories/' + catProd.category_id,
          method: 'GET',
          headers: {
            Authorization: 'Bearer ' + token,
            Accept: 'application/json',
          },
          timeout: 15,
        })
        console.log(
          '[0592_diag] GET /categories/' +
            catProd.category_id +
            ' status: ' +
            cRes.statusCode +
            ', settings: ' +
            JSON.stringify(cRes.json ? cRes.json.settings : null),
        )
      } catch (e2) {
        console.log('[0592_diag] Erro GET category: ' + e2)
      }
    }

    // 3. POST /items/validate com o payload exato
    const catId = catProd && catProd.category_id ? catProd.category_id : 'MLB1692' // MLB-COMPUTER_MOTHERBOARDS
    const testPayload = {
      catalog_product_id: catalogProductId,
      catalog_listing: true,
      category_id: catId,
      price: 699,
      currency_id: 'BRL',
      available_quantity: 1,
      buying_mode: 'buy_it_now',
      listing_type_id: 'gold_special',
      condition: 'new',
      shipping: {
        mode: 'me2',
        local_pick_up: true,
        free_shipping: true,
      },
      sale_terms: [
        { id: 'WARRANTY_TYPE', value_name: 'Garantia do vendedor' },
        { id: 'WARRANTY_TIME', value_name: '90 dias' },
      ],
      attributes: [{ id: 'ITEM_CONDITION', value_id: '2230284' }],
    }

    try {
      const vRes = $http.send({
        url: 'https://api.mercadolibre.com/items/validate',
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(testPayload),
        timeout: 15,
      })
      console.log(
        '[0592_diag] POST /items/validate status: ' + vRes.statusCode + ', body: ' + vRes.raw,
      )
    } catch (e3) {
      console.log('[0592_diag] Erro POST /items/validate: ' + e3)
    }

    // 4. Testar POST /items direto mas capturando todos os headers da resposta (incluindo x-policy-agent-action, etc.)
    try {
      const pPostRes = $http.send({
        url: 'https://api.mercadolibre.com/items',
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(testPayload),
        timeout: 15,
      })
      console.log(
        '[0592_diag] POST /items status: ' +
          pPostRes.statusCode +
          ', headers: ' +
          JSON.stringify(pPostRes.headers) +
          ', body: ' +
          pPostRes.raw,
      )
    } catch (e4) {
      console.log('[0592_diag] Erro POST /items: ' + e4)
    }
  },
  (app) => {},
)
