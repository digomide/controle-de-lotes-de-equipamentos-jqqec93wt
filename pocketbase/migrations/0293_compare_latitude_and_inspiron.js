migrate(
  (app) => {
    const rec = app.findFirstRecordByFilter(
      'ml_ads_fetch_jobs',
      "status_filter = '__DIAG_INSPIRON_3576__'",
    )
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    let token = sRecords.length > 0 ? sRecords[0].getString('access_token') : ''

    // 1. Investigar MLB7591024470 no item da API
    let itData = null
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
          itData = {
            id: j.id,
            title: j.title,
            price: j.price,
            status: j.status,
            thumbnail: j.thumbnail,
            pictures: (j.pictures || []).slice(0, 2).map((p) => p.url),
            available_quantity: j.available_quantity,
            attributes: (j.attributes || []).map((a) => ({
              id: a.id,
              name: a.name,
              val: a.value_name,
              vid: a.value_id,
            })),
            permalink: j.permalink,
          }
        }
      } catch (e) {}
    }

    // 2. Investigar MLB7566367408 (o Latitude 5420) no fetch_jobs
    const adsJobs = app.findRecordsByFilter(
      'ml_ads_fetch_jobs',
      "status = 'done' && items_count > 0",
      '-created',
      1,
      0,
    )
    let rawAdsItems = adsJobs[0].getString('items') || adsJobs[0].get('items')
    let parsedAds = typeof rawAdsItems === 'string' ? JSON.parse(rawAdsItems) : rawAdsItems
    let lat5420 = parsedAds.find((a) => a.id === 'MLB7566367408')
    let insp3576 = parsedAds.find((a) => a.id === 'MLB7591024470')

    rec.set(
      'progress_text',
      'lat5420 cat: ' +
        (lat5420 ? lat5420.catalog_product_id : 'null') +
        ' | insp3576 cat: ' +
        (insp3576 ? insp3576.catalog_product_id : 'null'),
    )
    rec.set(
      'error_message',
      JSON.stringify({
        lat5420: lat5420,
        insp3576: insp3576,
        itDataAttrs: itData ? itData.attributes : null,
      }),
    )
    app.save(rec)
  },
  (app) => {},
)
