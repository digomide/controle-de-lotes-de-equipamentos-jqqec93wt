migrate(
  (app) => {
    // 0341_check_errors_only.js
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (!sRecords || sRecords.length === 0) return
    const token = sRecords[0].getString('access_token')

    const test = (catalogId, conditionRoot, grading) => {
      const p = {
        catalog_product_id: catalogId,
        catalog_listing: true,
        category_id: 'MLB1652',
        price: 3500,
        currency_id: 'BRL',
        available_quantity: 1,
        buying_mode: 'buy_it_now',
        listing_type_id: 'gold_special',
        sale_terms: [
          { id: 'WARRANTY_TYPE', value_name: 'Garantia do vendedor' },
          { id: 'WARRANTY_TIME', value_name: '90 dias' },
        ],
        shipping: { mode: 'me2', local_pick_up: true, free_shipping: true },
        attributes: [{ id: 'ITEM_CONDITION', value_id: '2230582' }],
      }
      if (conditionRoot !== null) p.condition = conditionRoot
      if (grading) p.attributes.push({ id: 'GRADING', value_id: grading })

      const res = $http.send({
        url: 'https://api.mercadolibre.com/items/validate',
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
        timeout: 15,
      })
      const errors = (res.json?.cause || []).filter(
        (c) => c.type !== 'warning' && !c.code?.includes('lost_me1'),
      )
      return {
        status: res.statusCode,
        errors: errors.map((c) => c.code + ': ' + c.message),
      }
    }

    // 1: MLB2097858038 com condition 'new' + GRADING 40108830
    const t1 = test('MLB2097858038', 'new', '40108830')
    // 2: MLB2097858038 sem condition raiz
    const t2 = test('MLB2097858038', null, '40108830')
    // 3: MLB2097858038 sem condition raiz e sem GRADING
    const t3 = test('MLB2097858038', null, null)

    // 4: MLB18732668 com condition 'new' + GRADING 40108830
    const t4 = test('MLB18732668', 'new', '40108830')
    // 5: MLB18732668 sem condition raiz
    const t5 = test('MLB18732668', null, null)

    const col = app.findCollectionByNameOrId('ml_ads_fetch_jobs')
    const diag = new Record(col)
    diag.set('status', 'done')
    diag.set('status_filter', '__PERICIA_0341__')
    diag.set(
      'progress_text',
      'Errors: t1=' +
        t1.errors.length +
        ' t2=' +
        t2.errors.length +
        ' t3=' +
        t3.errors.length +
        ' t4=' +
        t4.errors.length +
        ' t5=' +
        t5.errors.length,
    )
    diag.set('error_message', JSON.stringify({ t1, t2, t3, t4, t5 }))
    app.save(diag)
  },
  (app) => {},
)
