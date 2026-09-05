migrate(
  (app) => {
    // 0245: Investigar o array items de ml_ads_fetch_jobs
    const adsJobs = app.findRecordsByFilter(
      'ml_ads_fetch_jobs',
      "status = 'done' && items_count > 0",
      '-created',
      1,
      0,
    )

    let itemsLen = 0
    let has7566 = false
    let item7566Data = null
    let sampleKeys = []
    let sampleItems = []

    if (adsJobs.length > 0) {
      const items = adsJobs[0].get('items') || []
      itemsLen = items.length
      for (let i = 0; i < items.length; i++) {
        const it = items[i]
        if (i === 0) sampleKeys = Object.keys(it)
        if (it.id === 'MLB7566367408' || String(it.title || '').includes('5420')) {
          sampleItems.push({
            id: it.id,
            title: it.title,
            catalog_product_id: it.catalog_product_id,
            catalog_listing: it.catalog_listing,
            condition: it.condition,
          })
          if (it.id === 'MLB7566367408') {
            has7566 = true
            item7566Data = it
          }
        }
      }
    }

    const rec = app.findFirstRecordByData('ml_catalog_search_jobs', 'query', '__PROBE_0243_VIEW__')
    if (rec) {
      rec.set(
        'progress_text',
        'itemsLen: ' +
          itemsLen +
          ' has7566: ' +
          has7566 +
          ' sampleCount: ' +
          sampleItems.length +
          ' keys: ' +
          sampleKeys.join(','),
      )
      rec.set('error_message', JSON.stringify({ item7566Data: item7566Data, sampleItems }))
      app.save(rec)
    }
  },
  (app) => {},
)
