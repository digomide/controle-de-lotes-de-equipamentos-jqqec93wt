migrate(
  (app) => {
    // 0255: Ler testJob e verificar o que matchedAccountCatalog encontrou
    const testJob = app.findFirstRecordByData(
      'ml_catalog_search_jobs',
      'query',
      '__PROBE_0243_VIEW__',
    )
    if (testJob) {
      const txt = testJob.getString('progress_text')
      // Se não encontrou nada com os 3 tokens, verificar quais anúncios do vendedor têm 5420
      const adsJobs = app.findRecordsByFilter(
        'ml_ads_fetch_jobs',
        "status = 'done' && items_count > 0",
        '-created',
        1,
        0,
      )
      let found5420 = []
      if (adsJobs.length > 0) {
        const items = adsJobs[0].get('items') || []
        for (let i = 0; i < items.length; i++) {
          const ad = items[i]
          const title = ad.title || ''
          if (title.includes('5420')) {
            found5420.push({
              id: ad.id,
              title: title,
              cat: ad.catalog_product_id,
              brand: ad.brand,
              cond: ad.condition,
            })
          }
        }
      }
      testJob.set('status_filter', 'found5420_count_' + found5420.length)
      testJob.set(
        'error_message',
        JSON.stringify({
          prevTxt: txt,
          found5420: found5420,
        }),
      )
      app.save(testJob)
    }
  },
  (app) => {},
)
