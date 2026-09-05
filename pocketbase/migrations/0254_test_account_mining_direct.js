migrate(
  (app) => {
    // 0254: Escrever um teste direto de mineração e enriquecimento no job de teste:
    // Pega a query "dell latitude 5420"
    // Executa a lógica de mineração da conta (ml_ads_fetch_jobs)
    const adsJobs = app.findRecordsByFilter(
      'ml_ads_fetch_jobs',
      "status = 'done' && items_count > 0",
      '-created',
      1,
      0,
    )

    const queryTokens = ['dell', 'latitude', '5420']
    const matchedAccountCatalog = []
    const seenCatIds = {}

    if (adsJobs.length > 0) {
      const items = adsJobs[0].get('items') || []
      for (let i = 0; i < items.length; i++) {
        const ad = items[i]
        if (!ad.catalog_product_id) continue

        const titleLower = (ad.title || '').toLowerCase()
        const brandLower = (ad.brand || '').toLowerCase()
        const modelLower = (ad.model || '').toLowerCase()
        const textToMatch = titleLower + ' ' + brandLower + ' ' + modelLower

        // Match de tokens
        let matches = true
        for (let t = 0; t < queryTokens.length; t++) {
          if (!textToMatch.includes(queryTokens[t])) {
            matches = false
            break
          }
        }

        if (matches && !seenCatIds[ad.catalog_product_id]) {
          seenCatIds[ad.catalog_product_id] = true
          matchedAccountCatalog.push({
            ad_id: ad.id,
            catalog_product_id: ad.catalog_product_id,
            title: ad.title,
            condition: ad.condition,
            condition_grade: ad.condition_grade,
          })
        }
      }
    }

    const testJob = app.findFirstRecordByData(
      'ml_catalog_search_jobs',
      'query',
      '__PROBE_0243_VIEW__',
    )
    if (testJob) {
      testJob.set(
        'progress_text',
        'MATCHED: ' + matchedAccountCatalog.length + ' -> ' + JSON.stringify(matchedAccountCatalog),
      )
      app.save(testJob)
    }
  },
  (app) => {},
)
