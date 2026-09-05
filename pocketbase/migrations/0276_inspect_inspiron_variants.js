migrate(
  (app) => {
    const rec = app.findFirstRecordByFilter(
      'ml_ads_fetch_jobs',
      "status_filter = '__DIAG_INSPIRON_3576__'",
    )
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    let token = sRecords.length > 0 ? sRecords[0].getString('access_token') : ''

    let p25092593 = null
    let itemsInProd = null
    if (token) {
      try {
        const r = $http.send({
          url: 'https://api.mercadolibre.com/products/MLB25092593',
          method: 'GET',
          headers: { Authorization: 'Bearer ' + token },
          timeout: 10,
        })
        if (r.statusCode === 200)
          p25092593 = {
            id: r.json.id,
            name: r.json.name,
            buy_box: r.json.buy_box_winner,
            attributes: (r.json.attributes || []).map((a) => a.id + '=' + a.value_name),
          }
      } catch (e) {}

      try {
        const r2 = $http.send({
          url: 'https://api.mercadolibre.com/products/MLB15392536/items',
          method: 'GET',
          headers: { Authorization: 'Bearer ' + token },
          timeout: 10,
        })
        if (r2.statusCode === 200) itemsInProd = r2.json
      } catch (e) {}
    }

    // Verificar na conta do vendedor se existe outro anúncio do Inspiron 3576
    const adsJobs = app.findRecordsByFilter(
      'ml_ads_fetch_jobs',
      "status = 'done' && items_count > 0",
      '-created',
      1,
      0,
    )
    let rawAdsItems = adsJobs[0].getString('items') || adsJobs[0].get('items')
    let parsedAds = typeof rawAdsItems === 'string' ? JSON.parse(rawAdsItems) : rawAdsItems
    let matches3576 = parsedAds.filter((a) => JSON.stringify(a).includes('3576'))

    rec.set(
      'progress_text',
      'matches3576 count: ' +
        matches3576.length +
        ' ids: ' +
        matches3576.map((a) => a.id).join(', '),
    )
    rec.set(
      'error_message',
      JSON.stringify({ p25092593: p25092593, itemsInProd: itemsInProd, matches3576: matches3576 }),
    )
    app.save(rec)
  },
  (app) => {},
)
