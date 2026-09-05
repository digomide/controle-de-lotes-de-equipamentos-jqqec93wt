migrate(
  (app) => {
    // 0248: Verificar como `items` vem do record do PocketBase no JS VM
    const adsJobs = app.findRecordsByFilter(
      'ml_ads_fetch_jobs',
      "status = 'done' && items_count > 0",
      '-created',
      1,
      0,
    )

    let reportText = ''
    if (adsJobs.length > 0) {
      const rec = adsJobs[0]
      const rawObj = rec.get('items')
      // Pode ser um array ou types.JsonRaw
      let parsed = []
      try {
        if (typeof rawObj === 'string') {
          parsed = JSON.parse(rawObj)
        } else if (Array.isArray(rawObj)) {
          parsed = rawObj
        } else {
          // tentar JSON.stringify e parse
          parsed = JSON.parse(JSON.stringify(rawObj))
        }
      } catch (e) {
        reportText += 'ERR_PARSE: ' + String(e) + ' '
      }

      reportText += 'parsedLen: ' + (parsed ? parsed.length : 'null') + ' '
      let foundMatches = 0
      let sampleMatch = null
      if (Array.isArray(parsed)) {
        for (let i = 0; i < parsed.length; i++) {
          const it = parsed[i]
          if (
            it &&
            (it.id === 'MLB7566367408' ||
              it.catalog_product_id === 'MLB2097858038' ||
              (it.title && it.title.indexOf('5420') !== -1))
          ) {
            foundMatches++
            if (!sampleMatch) sampleMatch = it
          }
        }
      }
      reportText += 'matches: ' + foundMatches + ' sample: ' + (sampleMatch ? sampleMatch.id : 'no')
    }

    const targetJob = app.findFirstRecordByData(
      'ml_catalog_search_jobs',
      'query',
      '__PROBE_0243_VIEW__',
    )
    if (targetJob) {
      targetJob.set('progress_text', reportText.substring(0, 150))
      app.save(targetJob)
    }
  },
  (app) => {},
)
