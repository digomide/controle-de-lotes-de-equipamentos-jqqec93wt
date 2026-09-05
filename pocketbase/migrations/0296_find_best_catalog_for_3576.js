migrate(
  (app) => {
    const rec = app.findFirstRecordByFilter(
      'ml_ads_fetch_jobs',
      "status_filter = '__DIAG_INSPIRON_3576__'",
    )
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    let token = sRecords.length > 0 ? sRecords[0].getString('access_token') : ''

    // Procurar "Dell Inspiron 3576" no catálogo ML:
    let catalogMatch = null
    if (token) {
      try {
        const res = $http.send({
          url:
            'https://api.mercadolibre.com/products/search?status=active&site_id=MLB&q=' +
            encodeURIComponent('Dell Inspiron 3576') +
            '&limit=10',
          method: 'GET',
          headers: { Authorization: 'Bearer ' + token },
          timeout: 10,
        })
        if (res.statusCode === 200 && res.json && res.json.results) {
          // Encontrar os produtos de catálogo mais pertinentes (ex: notebooks 3576)
          catalogMatch = res.json.results.map((r) => ({
            id: r.id,
            name: r.name,
            domain_id: r.domain_id,
            condition: r.condition,
            parent_id: r.parent_id,
            buy_box_winner: r.buy_box_winner
              ? {
                  price: r.buy_box_winner.price,
                  seller_id: r.buy_box_winner.seller_id,
                  item_id: r.buy_box_winner.item_id,
                }
              : null,
          }))
        }
      } catch (e) {
        catalogMatch = { error: String(e) }
      }
    }

    rec.set(
      'progress_text',
      'catMatch: ' +
        (Array.isArray(catalogMatch)
          ? catalogMatch
              .map((c) => c.id + ':' + c.name)
              .slice(0, 3)
              .join(' | ')
          : 'err'),
    )
    rec.set('error_message', JSON.stringify(catalogMatch))
    app.save(rec)
  },
  (app) => {},
)
