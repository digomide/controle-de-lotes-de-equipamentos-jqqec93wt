migrate(
  (app) => {
    // 0257: Provar de vez que MLB2097858038 e todos os anúncios próprios casam
    const testJob = app.findFirstRecordByData(
      'ml_catalog_search_jobs',
      'query',
      '__PROBE_0243_VIEW__',
    )
    const adsJobs = app.findRecordsByFilter(
      'ml_ads_fetch_jobs',
      "status = 'done' && items_count > 0",
      '-created',
      1,
      0,
    )
    let ad7566 = null
    if (adsJobs.length > 0) {
      const items = adsJobs[0].get('items') || []
      for (let i = 0; i < items.length; i++) {
        if (items[i].id === 'MLB7566367408') {
          ad7566 = items[i]
          break
        }
      }
    }

    if (testJob) {
      testJob.set(
        'progress_text',
        'AD7566: ' +
          (ad7566
            ? 'title=' +
              ad7566.title +
              ' catId=' +
              ad7566.catalog_product_id +
              ' cond=' +
              ad7566.condition
            : 'not found'),
      )
      app.save(testJob)
    }
  },
  (app) => {},
)
