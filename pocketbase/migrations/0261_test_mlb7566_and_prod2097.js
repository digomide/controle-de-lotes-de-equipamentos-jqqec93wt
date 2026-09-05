migrate(
  (app) => {
    // 0261: Testar o que o item MLB7566367408 contém e como a busca de anúncios próprios da conta deve funcionar
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    const token = sRecords.length > 0 ? sRecords[0].getString('access_token') : ''
    const sellerId = sRecords.length > 0 ? sRecords[0].getString('user_id_ml') : '626774396'

    // O seller é 626774396.
    // Vamos testar:
    // 1) Consultar os anúncios ativos ou pausados do seller com termo 'latitude' ou '5420'
    const resSearch = $http.send({
      url: 'https://api.mercadolibre.com/users/' + sellerId + '/items/search?q=5420',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 10,
    })

    // 2) Consultar GET /items/MLB7566367408
    const resItem = $http.send({
      url: 'https://api.mercadolibre.com/items/MLB7566367408',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 10,
    })

    // 3) Consultar GET /products/MLB2097858038
    const resProd = $http.send({
      url: 'https://api.mercadolibre.com/products/MLB2097858038',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 10,
    })

    const col = app.findCollectionByNameOrId('ml_ads_fetch_jobs')
    const diag = new Record(col)
    diag.set('status', 'done')
    diag.set('status_filter', '__DIAG_0261__')
    diag.set(
      'progress_text',
      'search: ' +
        (resSearch.json && resSearch.json.results
          ? resSearch.json.results.length
          : resSearch.statusCode) +
        ' item7566: ' +
        resItem.statusCode +
        ' prod2097: ' +
        resProd.statusCode,
    )
    diag.set(
      'error_message',
      JSON.stringify({
        search_results: resSearch.json?.results,
        item7566: resItem.json
          ? {
              id: resItem.json.id,
              title: resItem.json.title,
              catalog_product_id: resItem.json.catalog_product_id,
              condition: resItem.json.condition,
              status: resItem.json.status,
            }
          : null,
        prod2097: resProd.json
          ? {
              id: resProd.json.id,
              name: resProd.json.name,
              status: resProd.json.status,
              buy_box_winner: resProd.json.buy_box_winner,
            }
          : null,
      }),
    )
    app.save(diag)
  },
  (app) => {},
)
