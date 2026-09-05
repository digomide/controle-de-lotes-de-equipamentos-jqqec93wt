migrate(
  (app) => {
    // 0244: Provar se o hook em ml_catalog_search_queue.js pode ler ml_ads_fetch_jobs
    // e extrair todos os anúncios de catálogo do vendedor
    const adsJobs = app.findRecordsByFilter(
      'ml_ads_fetch_jobs',
      "status = 'done' && items_count > 0",
      '-created',
      1,
      0,
    )

    let totalCatalogAds = 0
    let dell5420CatalogId = ''
    let sample5420Ad = null

    if (adsJobs.length > 0) {
      const items = adsJobs[0].get('items') || []
      for (let i = 0; i < items.length; i++) {
        const it = items[i]
        if (it.catalog_product_id) {
          totalCatalogAds++
          const t = (it.title || '').toLowerCase()
          if (t.includes('5420')) {
            dell5420CatalogId = it.catalog_product_id
            sample5420Ad = {
              id: it.id,
              title: it.title,
              catalog_product_id: it.catalog_product_id,
              condition: it.condition,
              condition_grade: it.condition_grade,
              status: it.status,
              price: it.price,
            }
          }
        }
      }
    }

    // Gravar no registro __PROBE_0243_VIEW__
    const rec = app.findFirstRecordByData('ml_catalog_search_jobs', 'query', '__PROBE_0243_VIEW__')
    if (rec) {
      rec.set(
        'progress_text',
        'totalCatAds: ' + totalCatalogAds + ' 5420CatId: ' + dell5420CatalogId,
      )
      rec.set('error_message', JSON.stringify({ sample5420Ad: sample5420Ad }))
      app.save(rec)
    }
  },
  (app) => {},
)
