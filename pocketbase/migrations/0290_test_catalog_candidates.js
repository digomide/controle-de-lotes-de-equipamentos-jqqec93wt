migrate(
  (app) => {
    const rec = app.findFirstRecordByFilter(
      'ml_ads_fetch_jobs',
      "status_filter = '__DIAG_INSPIRON_3576__'",
    )
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    let token = sRecords.length > 0 ? sRecords[0].getString('access_token') : ''

    // 1. O que /products/search?site_id=MLB&q=dell inspiron 3576 retorna?
    let normalSearch = []
    if (token) {
      try {
        const ps = $http.send({
          url:
            'https://api.mercadolibre.com/products/search?status=active&site_id=MLB&q=' +
            encodeURIComponent('dell inspiron 3576') +
            '&limit=10',
          method: 'GET',
          headers: { Authorization: 'Bearer ' + token },
          timeout: 10,
        })
        if (ps.statusCode === 200 && ps.json) {
          normalSearch = (ps.json.results || []).map((r) => ({
            id: r.id,
            name: r.name,
            buy_box_winner: r.buy_box_winner
              ? {
                  seller_id: r.buy_box_winner.seller_id,
                  item_id: r.buy_box_winner.item_id,
                  price: r.buy_box_winner.price,
                  condition: r.buy_box_winner.condition,
                }
              : null,
            condition: r.condition,
            attributes: (r.attributes || [])
              .filter(
                (a) =>
                  a.id === 'BRAND' ||
                  a.id === 'MODEL' ||
                  a.id === 'GRADING' ||
                  a.id === 'ITEM_CONDITION',
              )
              .map((a) => a.id + '=' + a.value_name),
          }))
        }
      } catch (e) {}
    }

    rec.set(
      'progress_text',
      'normalSearch count: ' +
        normalSearch.length +
        ' ids: ' +
        normalSearch.map((r) => r.id).join(', '),
    )
    rec.set('error_message', JSON.stringify(normalSearch))
    app.save(rec)
  },
  (app) => {},
)
