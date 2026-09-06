migrate(
  (app) => {
    // 0337_test_validations_hypothesis.js
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (!sRecords || sRecords.length === 0) return
    const token = sRecords[0].getString('access_token')

    // Base de frete e garantia
    const baseShipping = { mode: 'me2', local_pick_up: true, free_shipping: true }
    const baseSaleTerms = [
      { id: 'WARRANTY_TYPE', value_name: 'Garantia do vendedor' },
      { id: 'WARRANTY_TIME', value_name: '90 dias' },
    ]

    const testPayload = (catId, rootCond, attrs) => {
      const p = {
        catalog_product_id: catId,
        catalog_listing: true,
        category_id: 'MLB1652',
        price: 3500,
        currency_id: 'BRL',
        available_quantity: 1,
        buying_mode: 'buy_it_now',
        listing_type_id: 'gold_special',
        sale_terms: baseSaleTerms,
        shipping: baseShipping,
        attributes: attrs,
      }
      if (rootCond !== null) {
        p.condition = rootCond
      }
      const res = $http.send({
        url: 'https://api.mercadolibre.com/items/validate',
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(p),
        timeout: 15,
      })
      return {
        status: res.statusCode,
        json: res.json,
      }
    }

    // Teste 1: MLB2097858038 (posição recondicionada encontrada)
    // 1A: condition: "new" + ITEM_CONDITION: 2230582 + GRADING: 40108830
    const t1A = testPayload('MLB2097858038', 'new', [
      { id: 'ITEM_CONDITION', value_id: '2230582' },
      { id: 'GRADING', value_id: '40108830' },
    ])

    // 1B: SEM condition raiz + ITEM_CONDITION: 2230582
    const t1B = testPayload('MLB2097858038', null, [{ id: 'ITEM_CONDITION', value_id: '2230582' }])

    // Teste 2: MLB18732668 (posição NOVO original onde o usuário/sistema tentou publicar como recondicionado)
    // 2A: o que enviamos antes (SEM condition raiz + ITEM_CONDITION 2230582)
    const t2A = testPayload('MLB18732668', null, [{ id: 'ITEM_CONDITION', value_id: '2230582' }])

    // 2B: condition: "new" + ITEM_CONDITION: 2230582 (será que passa na posição novo?)
    const t2B = testPayload('MLB18732668', 'new', [{ id: 'ITEM_CONDITION', value_id: '2230582' }])

    // 2C: condition: "new" + ITEM_CONDITION: 2230582 + GRADING: 40108830
    const t2C = testPayload('MLB18732668', 'new', [
      { id: 'ITEM_CONDITION', value_id: '2230582' },
      { id: 'GRADING', value_id: '40108830' },
    ])

    // 2D: condition: "refurbished" + ITEM_CONDITION: 2230582
    const t2D = testPayload('MLB18732668', 'refurbished', [
      { id: 'ITEM_CONDITION', value_id: '2230582' },
    ])

    // Teste 3: Como encontrar a posição irmã recondicionada se o usuário passar MLB18732668?
    // Vamos testar /products/search com o nome do produto ou family/parent
    const searchProdRes = $http.send({
      url: 'https://api.mercadolibre.com/products/search?status=active&site_id=MLB&q=Latitude+5420+recondicionado&limit=10',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 10,
    })

    const col = app.findCollectionByNameOrId('ml_ads_fetch_jobs')
    const diag = new Record(col)
    diag.set('status', 'done')
    diag.set('status_filter', '__PERICIA_0337__')
    diag.set(
      'progress_text',
      '1A:' +
        t1A.status +
        ' 1B:' +
        t1B.status +
        ' 2A:' +
        t2A.status +
        ' 2B:' +
        t2B.status +
        ' 2C:' +
        t2C.status +
        ' 2D:' +
        t2D.status,
    )
    diag.set(
      'error_message',
      JSON.stringify({
        t1A: t1A.json || t1A.status,
        t1B: t1B.json || t1B.status,
        t2A: t2A.json || t2A.status,
        t2B: t2B.json || t2B.status,
        t2C: t2C.json || t2C.status,
        t2D: t2D.json || t2D.status,
        search_products: (searchProdRes.json?.results || []).map((p) => ({
          id: p.id,
          name: p.name,
          parent_id: p.parent_id,
        })),
      }).substring(0, 4900),
    )
    app.save(diag)
  },
  (app) => {},
)
