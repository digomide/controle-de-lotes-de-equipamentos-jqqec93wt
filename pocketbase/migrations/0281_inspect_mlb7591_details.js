migrate(
  (app) => {
    const rec = app.findFirstRecordByFilter(
      'ml_ads_fetch_jobs',
      "status_filter = '__DIAG_INSPIRON_3576__'",
    )
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    let token = sRecords.length > 0 ? sRecords[0].getString('access_token') : ''

    let buyBoxItems = []
    let compSearch = []
    if (token) {
      try {
        // Testar GET /products/MLB15392536
        const r = $http.send({
          url: 'https://api.mercadolibre.com/products/MLB15392536',
          method: 'GET',
          headers: { Authorization: 'Bearer ' + token },
          timeout: 10,
        })
        // Testar GET /items/MLB7591024470 com token de autorização completo
        const it = $http.send({
          url: 'https://api.mercadolibre.com/items/MLB7591024470',
          method: 'GET',
          headers: { Authorization: 'Bearer ' + token },
          timeout: 10,
        })
        const itJ = it.json
        // Verificar se há catalog_product_id em algum lugar do item json
        const itStr = JSON.stringify(itJ)
        const matchesCatalog = itStr.match(/"catalog[^"]*"\s*:\s*[^,}]+/g) || []

        rec.set('progress_text', 'itemMatches: ' + matchesCatalog.join('; '))
        rec.set(
          'error_message',
          JSON.stringify({
            catalogMatches: matchesCatalog,
            prod15392536_status: r.statusCode,
            prod15392536_buybox: r.json ? r.json.buy_box_winner : null,
            item_title: itJ.title,
            item_price: itJ.price,
            item_condition: itJ.condition,
          }),
        )
        app.save(rec)
      } catch (e) {
        rec.set('progress_text', 'err: ' + String(e))
        app.save(rec)
      }
    }
  },
  (app) => {},
)
