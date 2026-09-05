migrate(
  (app) => {
    const rec = app.findFirstRecordByFilter(
      'ml_ads_fetch_jobs',
      "status_filter = '__DIAG_INSPIRON_3576__'",
    )
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    let token = sRecords.length > 0 ? sRecords[0].getString('access_token') : ''

    let searchRes = null
    let itemRes = null

    if (token) {
      // 1. item attributes
      try {
        const it = $http.send({
          url: 'https://api.mercadolibre.com/items/MLB7591024470',
          method: 'GET',
          headers: { Authorization: 'Bearer ' + token },
          timeout: 10,
        })
        if (it.statusCode === 200) {
          const j = it.json
          itemRes = {
            domain_id: j.domain_id,
            category_id: j.category_id,
            permalink: j.permalink,
            attributes: (j.attributes || [])
              .map((a) => ({ id: a.id, value_name: a.value_name, value_id: a.value_id }))
              .slice(0, 15),
          }
        }
      } catch (e) {}

      // 2. Buscar no /products/search por "Dell Inspiron 3576" ou "Inspiron 3576"
      try {
        const ps = $http.send({
          url:
            'https://api.mercadolibre.com/products/search?site_id=MLB&q=' +
            encodeURIComponent('Inspiron 3576') +
            '&limit=10',
          method: 'GET',
          headers: { Authorization: 'Bearer ' + token },
          timeout: 10,
        })
        if (ps.statusCode === 200 && ps.json) {
          const results = ps.json.results || []
          searchRes = results.map((r) => ({
            id: r.id,
            name: r.name || r.title,
            domain_id: r.domain_id,
            buy_box_winner: r.buy_box_winner
              ? {
                  price: r.buy_box_winner.price,
                  seller_id: r.buy_box_winner.seller_id,
                  item_id: r.buy_box_winner.item_id,
                }
              : null,
            attributes: (r.attributes || [])
              .filter((a) => ['BRAND', 'MODEL', 'GRADING', 'ITEM_CONDITION'].includes(a.id))
              .map((a) => ({ id: a.id, val: a.value_name })),
          }))
        }
      } catch (e) {
        searchRes = { error: String(e) }
      }
    }

    rec.set(
      'progress_text',
      'searchRes: ' +
        (Array.isArray(searchRes) ? searchRes.length : 'err') +
        ' itemDomain: ' +
        (itemRes ? itemRes.domain_id : 'null'),
    )
    rec.set('error_message', JSON.stringify({ itemRes: itemRes, searchRes: searchRes }))
    app.save(rec)
  },
  (app) => {},
)
