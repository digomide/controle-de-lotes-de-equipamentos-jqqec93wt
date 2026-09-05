migrate(
  (app) => {
    const rec = app.findFirstRecordByFilter(
      'ml_ads_fetch_jobs',
      "status_filter = '__DIAG_INSPIRON_3576__'",
    )
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    let token = sRecords.length > 0 ? sRecords[0].getString('access_token') : ''

    let userItems = []
    if (token) {
      try {
        const uRes = $http.send({
          url: 'https://api.mercadolibre.com/users/626774396/items/search?search_type=scan',
          method: 'GET',
          headers: { Authorization: 'Bearer ' + token },
          timeout: 10,
        })
        // Ou buscar anúncios ativos
        const uRes2 = $http.send({
          url: 'https://api.mercadolibre.com/users/626774396/items/search?status=active&limit=50',
          method: 'GET',
          headers: { Authorization: 'Bearer ' + token },
          timeout: 10,
        })
        userItems = uRes2.json ? uRes2.json.results || [] : []
      } catch (e) {}
    }

    // Verificar na lista dos 564 anúncios se há algum outro com "3576" ou "inspiron"
    const adsJobs = app.findRecordsByFilter(
      'ml_ads_fetch_jobs',
      "status = 'done' && items_count > 0",
      '-created',
      1,
      0,
    )
    let rawAdsItems = adsJobs[0].getString('items') || adsJobs[0].get('items')
    let parsedAds = typeof rawAdsItems === 'string' ? JSON.parse(rawAdsItems) : rawAdsItems
    let matchesInspiron = parsedAds.filter((a) =>
      String(a.title || '')
        .toLowerCase()
        .includes('inspiron'),
    )

    rec.set(
      'progress_text',
      'matchesInspiron: ' +
        matchesInspiron.length +
        ' titles: ' +
        matchesInspiron
          .slice(0, 3)
          .map((a) => a.id + ' (' + a.catalog_product_id + '): ' + a.title)
          .join(' | '),
    )
    rec.set(
      'error_message',
      JSON.stringify(
        matchesInspiron.map((a) => ({
          id: a.id,
          title: a.title,
          cat: a.catalog_product_id,
          cat_listing: a.catalog_listing,
          cond: a.condition,
        })),
      ),
    )
    app.save(rec)
  },
  (app) => {},
)
