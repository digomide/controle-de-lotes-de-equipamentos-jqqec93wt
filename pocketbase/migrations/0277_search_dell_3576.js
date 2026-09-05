migrate(
  (app) => {
    const rec = app.findFirstRecordByFilter(
      'ml_ads_fetch_jobs',
      "status_filter = '__DIAG_INSPIRON_3576__'",
    )
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    let token = sRecords.length > 0 ? sRecords[0].getString('access_token') : ''

    let prodSearch = []
    if (token) {
      try {
        const ps = $http.send({
          url:
            'https://api.mercadolibre.com/products/search?site_id=MLB&q=' +
            encodeURIComponent('Dell 3576') +
            '&limit=15',
          method: 'GET',
          headers: { Authorization: 'Bearer ' + token },
          timeout: 10,
        })
        if (ps.statusCode === 200 && ps.json) {
          prodSearch = (ps.json.results || []).map((r) => ({
            id: r.id,
            name: r.name,
            domain_id: r.domain_id,
            condition: r.condition,
            buy_box_winner: r.buy_box_winner
              ? {
                  price: r.buy_box_winner.price,
                  seller_id: r.buy_box_winner.seller_id,
                  condition: r.buy_box_winner.condition,
                }
              : null,
          }))
        }
      } catch (e) {}
    }

    rec.set('progress_text', 'prodSearch count: ' + prodSearch.length)
    rec.set('error_message', JSON.stringify(prodSearch))
    app.save(rec)
  },
  (app) => {},
)
