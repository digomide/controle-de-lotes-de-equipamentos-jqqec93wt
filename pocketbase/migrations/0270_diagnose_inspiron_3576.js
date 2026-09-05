migrate(
  (app) => {
    // Diagnóstico para encontrar MLB7591024470 no último ml_ads_fetch_jobs
    const adsJobs = app.findRecordsByFilter(
      'ml_ads_fetch_jobs',
      "status = 'done' && items_count > 0",
      '-created',
      1,
      0,
    )
    let foundAd = null
    let adsCount = 0
    let sampleAdsWithCatalog = []
    if (adsJobs && adsJobs.length > 0) {
      let rawAdsItems = adsJobs[0].getString('items') || adsJobs[0].get('items')
      let parsedAds = []
      if (typeof rawAdsItems === 'string') {
        try {
          parsedAds = JSON.parse(rawAdsItems)
        } catch (e) {}
      } else if (Array.isArray(rawAdsItems)) {
        parsedAds = rawAdsItems
      }
      adsCount = parsedAds.length
      for (let i = 0; i < parsedAds.length; i++) {
        const a = parsedAds[i]
        if (a && a.id === 'MLB7591024470') {
          foundAd = a
        }
        if (a && String(a.title || '').includes('3576')) {
          sampleAdsWithCatalog.push({
            id: a.id,
            title: a.title,
            catalog_product_id: a.catalog_product_id,
            catalog_listing: a.catalog_listing,
            condition: a.condition,
          })
        }
      }
    }

    // Verificar na API do ML diretamente o que GET /items/MLB7591024470 retorna
    let apiItem = null
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    let token = sRecords.length > 0 ? sRecords[0].getString('access_token') : ''
    if (token) {
      try {
        const res = $http.send({
          url: 'https://api.mercadolibre.com/items/MLB7591024470',
          method: 'GET',
          headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
          timeout: 10,
        })
        if (res.statusCode === 200 && res.json) {
          const j = res.json
          apiItem = {
            id: j.id,
            title: j.title,
            catalog_product_id: j.catalog_product_id,
            catalog_listing: j.catalog_listing,
            condition: j.condition,
            status: j.status,
            permalink: j.permalink,
          }
        } else {
          apiItem = { statusCode: res.statusCode, error: res.raw }
        }
      } catch (e) {
        apiItem = { error: String(e) }
      }
    }

    // Criar um job temporário para ler o resultado
    const col = app.findCollectionByNameOrId('ml_ads_fetch_jobs')
    const probeRec = new Record(col, {
      status: 'done',
      status_filter: '__DIAG_INSPIRON_3576__',
      items_count: 0,
      progress_text:
        'foundInFetch: ' +
        (foundAd ? 'yes' : 'no') +
        ' matchCount: ' +
        sampleAdsWithCatalog.length +
        ' apiCat: ' +
        (apiItem ? apiItem.catalog_product_id : 'null'),
      error_message: JSON.stringify({
        foundAd: foundAd,
        sampleAdsWithCatalog: sampleAdsWithCatalog,
        apiItem: apiItem,
      }),
    })
    app.save(probeRec)
  },
  (app) => {},
)
