migrate(
  (app) => {
    // 0259: Investigar onde está MLB7566367408 nas coleções
    const testJob = app.findFirstRecordByData(
      'ml_catalog_search_jobs',
      'query',
      '__PROBE_0243_VIEW__',
    )

    // 1. Procurar em ml_ads_fetch_jobs
    let countInFetchJobs = 0
    let fetchJobSample = ''
    const allFetch = app.findRecordsByFilter(
      'ml_ads_fetch_jobs',
      "status = 'done'",
      '-created',
      5,
      0,
    )
    for (let f = 0; f < allFetch.length; f++) {
      const items = allFetch[f].get('items') || []
      for (let i = 0; i < items.length; i++) {
        if (items[i].id === 'MLB7566367408' || items[i].catalog_product_id === 'MLB2097858038') {
          countInFetchJobs++
          fetchJobSample = JSON.stringify(items[i])
        }
      }
    }

    // 2. Procurar na collection products
    const prods = app.findRecordsByFilter(
      'products',
      "ml_listing_id ~ '7566' || catalog_product_id ~ '2097'",
      '',
      5,
      0,
    )

    if (testJob) {
      testJob.set(
        'progress_text',
        'countInFetchJobs: ' +
          countInFetchJobs +
          ' sample: ' +
          fetchJobSample.substring(0, 100) +
          ' prods: ' +
          prods.length,
      )
      testJob.set('error_message', JSON.stringify({ fetchJobSample, prodsCount: prods.length }))
      app.save(testJob)
    }
  },
  (app) => {},
)
