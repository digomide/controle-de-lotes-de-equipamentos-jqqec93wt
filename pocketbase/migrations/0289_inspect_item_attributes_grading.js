migrate(
  (app) => {
    const rec = app.findFirstRecordByFilter(
      'ml_ads_fetch_jobs',
      "status_filter = '__DIAG_INSPIRON_3576__'",
    )
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    let token = sRecords.length > 0 ? sRecords[0].getString('access_token') : ''

    // Investigar /items/MLB7591024470/compatibilities ou /items/MLB7591024470/buy_box ou similares
    // E também testar se há catalog_product_id associável via /products/search?status=active&site_id=MLB&q=...
    let itemInfo = null
    if (token) {
      try {
        const it = $http.send({
          url: 'https://api.mercadolibre.com/items/MLB7591024470',
          method: 'GET',
          headers: { Authorization: 'Bearer ' + token },
          timeout: 10,
        })
        const j = it.json
        itemInfo = {
          catalog_product_id: j.catalog_product_id,
          catalog_listing: j.catalog_listing,
          status: j.status,
          condition: j.condition,
          permalink: j.permalink,
          pictures: (j.pictures || []).length,
          price: j.price,
          attributes_grading: (j.attributes || []).filter(
            (a) =>
              a.id === 'GRADING' || a.id === 'ITEM_CONDITION' || a.id === 'RECONDITIONED_STATUS',
          ),
        }
      } catch (e) {
        itemInfo = { error: String(e) }
      }
    }

    rec.set('progress_text', 'itemInfo: ' + JSON.stringify(itemInfo))
    app.save(rec)
  },
  (app) => {},
)
