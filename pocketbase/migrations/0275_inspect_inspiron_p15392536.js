migrate(
  (app) => {
    const rec = app.findFirstRecordByFilter(
      'ml_ads_fetch_jobs',
      "status_filter = '__DIAG_INSPIRON_3576__'",
    )
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    let token = sRecords.length > 0 ? sRecords[0].getString('access_token') : ''

    // 1. Investigar MLB15392536 e MLB15392537
    let p15392536 = null
    let p15392537 = null
    if (token) {
      try {
        const r1 = $http.send({
          url: 'https://api.mercadolibre.com/products/MLB15392536',
          method: 'GET',
          headers: { Authorization: 'Bearer ' + token },
          timeout: 10,
        })
        if (r1.statusCode === 200)
          p15392536 = {
            id: r1.json.id,
            name: r1.json.name,
            buy_box: r1.json.buy_box_winner,
            children_ids: r1.json.children_ids,
            parent_id: r1.json.parent_id,
          }
      } catch (e) {}
      try {
        const r2 = $http.send({
          url: 'https://api.mercadolibre.com/products/MLB15392537',
          method: 'GET',
          headers: { Authorization: 'Bearer ' + token },
          timeout: 10,
        })
        if (r2.statusCode === 200)
          p15392537 = {
            id: r2.json.id,
            name: r2.json.name,
            buy_box: r2.json.buy_box_winner,
            children_ids: r2.json.children_ids,
            parent_id: r2.json.parent_id,
          }
      } catch (e) {}
    }

    // 2. O que tem exatamente no item MLB7591024470?
    let item7591 = null
    if (token) {
      try {
        const it = $http.send({
          url: 'https://api.mercadolibre.com/items/MLB7591024470',
          method: 'GET',
          headers: { Authorization: 'Bearer ' + token },
          timeout: 10,
        })
        if (it.statusCode === 200) {
          const j = it.json
          item7591 = {
            id: j.id,
            title: j.title,
            price: j.price,
            status: j.status,
            catalog_product_id: j.catalog_product_id,
            catalog_listing: j.catalog_listing,
            condition: j.condition,
            seller_id: j.seller_id,
            permalink: j.permalink,
            tags: j.tags,
            channels: j.channels,
            sub_status: j.sub_status,
          }
        }
      } catch (e) {}
    }

    rec.set('progress_text', 'item7591: ' + JSON.stringify(item7591))
    rec.set(
      'error_message',
      JSON.stringify({ p15392536: p15392536, p15392537: p15392537, item7591: item7591 }),
    )
    app.save(rec)
  },
  (app) => {},
)
