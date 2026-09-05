migrate(
  (app) => {
    // 0264: Testar parsing de items do último ml_ads_fetch_jobs
    const adsJobs = app.findRecordsByFilter(
      'ml_ads_fetch_jobs',
      "status = 'done' && items_count > 0",
      '-created',
      1,
      0,
    )
    if (!adsJobs || adsJobs.length === 0) {
      console.log('[MIGRATION_0264] Nenhum ml_ads_fetch_jobs done')
      return
    }

    const j = adsJobs[0]
    const rawItems = j.get('items')
    console.log('[MIGRATION_0264] typeof rawItems: ' + typeof rawItems)
    console.log('[MIGRATION_0264] isArray: ' + Array.isArray(rawItems))

    let list = []
    if (typeof rawItems === 'string') {
      try {
        list = JSON.parse(rawItems)
      } catch (e) {
        console.log('[MIGRATION_0264] JSON.parse failed: ' + e)
      }
    } else if (Array.isArray(rawItems)) {
      list = rawItems
    }

    console.log('[MIGRATION_0264] list.length: ' + list.length)
    if (list.length > 0) {
      console.log('[MIGRATION_0264] Item 0: ' + JSON.stringify(list[0]).substring(0, 100))
    }

    // Procurar por 2097858038
    let found2097 = 0
    for (let i = 0; i < list.length; i++) {
      const it = list[i]
      if (String(it.catalog_product_id || '').includes('2097858038')) {
        found2097++
        console.log(
          '[MIGRATION_0264] MATCH 2097858038 -> title=' +
            it.title +
            ' | cat_id=' +
            it.catalog_product_id +
            ' | brand=' +
            it.brand +
            ' | model=' +
            it.model,
        )
      }
    }
    console.log('[MIGRATION_0264] Total found2097: ' + found2097)
  },
  (app) => {},
)
