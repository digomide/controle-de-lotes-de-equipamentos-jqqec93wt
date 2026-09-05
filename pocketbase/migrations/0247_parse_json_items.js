migrate(
  (app) => {
    // 0247: Ler campo items com rec.get('items') e iterar
    const adsJobs = app.findRecordsByFilter(
      'ml_ads_fetch_jobs',
      "status = 'done' && items_count > 0",
      '-created',
      1,
      0,
    )

    let foundItem = null
    if (adsJobs.length > 0) {
      const rec = adsJobs[0]
      // No PocketBase v0.36 JS VM: JSON field pode ser lido via rec.get('items')
      const items = rec.get('items')
      // Iterar e procurar 7566 ou 2097
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        const id = item.id || ''
        const catId = item.catalog_product_id || ''
        const title = item.title || ''
        if (id === 'MLB7566367408' || catId === 'MLB2097858038' || title.indexOf('5420') !== -1) {
          foundItem = {
            id: id,
            title: title,
            catalog_product_id: catId,
            condition: item.condition,
            condition_grade: item.condition_grade,
          }
          break
        }
      }
    }

    const targetJob = app.findFirstRecordByData(
      'ml_catalog_search_jobs',
      'query',
      '__PROBE_0243_VIEW__',
    )
    if (targetJob) {
      targetJob.set('progress_text', 'FOUND: ' + (foundItem ? foundItem.title : 'null'))
      targetJob.set('error_message', JSON.stringify({ foundItem: foundItem }))
      app.save(targetJob)
    }
  },
  (app) => {},
)
