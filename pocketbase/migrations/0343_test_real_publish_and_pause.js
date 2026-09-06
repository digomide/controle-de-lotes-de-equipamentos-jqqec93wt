migrate(
  (app) => {
    // 0343_test_real_publish_and_pause.js
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (!sRecords || sRecords.length === 0) return
    const token = sRecords[0].getString('access_token')

    // Testar publicação real de teste na posição MLB18732668 como recondicionado com:
    // condition: "new"
    // ITEM_CONDITION: 2230582
    // GRADING: 40108830 (Excelente)
    const p = {
      catalog_product_id: 'MLB18732668',
      catalog_listing: true,
      category_id: 'MLB1652',
      price: 9999, // Preço bem alto para não disputar Buy Box
      currency_id: 'BRL',
      available_quantity: 1,
      buying_mode: 'buy_it_now',
      listing_type_id: 'gold_special',
      condition: 'new',
      sale_terms: [
        { id: 'WARRANTY_TYPE', value_name: 'Garantia do vendedor' },
        { id: 'WARRANTY_TIME', value_name: '90 dias' },
      ],
      shipping: { mode: 'me2', local_pick_up: true, free_shipping: true },
      attributes: [
        { id: 'ITEM_CONDITION', value_id: '2230582' },
        { id: 'GRADING', value_id: '40108830' },
      ],
    }

    const postRes = $http.send({
      url: 'https://api.mercadolibre.com/items',
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(p),
      timeout: 25,
    })

    let createdId = ''
    let pauseRes = null
    if (postRes.statusCode === 200 || postRes.statusCode === 201) {
      createdId = postRes.json?.id || ''
      // PAUSAR IMEDIATAMENTE O ANÚNCIO DE TESTE
      if (createdId) {
        pauseRes = $http.send({
          url: 'https://api.mercadolibre.com/items/' + createdId,
          method: 'PUT',
          headers: {
            Authorization: 'Bearer ' + token,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ status: 'paused' }),
          timeout: 15,
        })
      }
    }

    // Registrar diagnóstico
    const col = app.findCollectionByNameOrId('ml_ads_fetch_jobs')
    const diag = new Record(col)
    diag.set('status', 'done')
    diag.set('status_filter', '__PERICIA_0343__')
    diag.set(
      'progress_text',
      'Publish status: ' +
        postRes.statusCode +
        ' created: ' +
        createdId +
        ' pause: ' +
        (pauseRes ? pauseRes.statusCode : 'none'),
    )
    diag.set(
      'error_message',
      JSON.stringify({
        post_status: postRes.statusCode,
        post_json: postRes.json
          ? {
              id: postRes.json.id,
              title: postRes.json.title,
              condition: postRes.json.condition,
              status: postRes.json.status,
              catalog_product_id: postRes.json.catalog_product_id,
            }
          : null,
        pause_status: pauseRes ? pauseRes.statusCode : null,
      }),
    )
    app.save(diag)
  },
  (app) => {},
)
