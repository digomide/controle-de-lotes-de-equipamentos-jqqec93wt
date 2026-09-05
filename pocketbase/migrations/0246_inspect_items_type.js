migrate(
  (app) => {
    // 0246: Como o campo `items` em ml_ads_fetch_jobs é armazenado? JSONField no PocketBase
    // Pode ser que `adsJobs[0].get('items')` retorne objeto não descompactado ou string ou bytes.
    // Vamos testar typeof e descompactação com JSON.parse se for string.
    const adsJobs = app.findRecordsByFilter(
      'ml_ads_fetch_jobs',
      "status = 'done' && items_count > 0",
      '-created',
      1,
      0,
    )

    let typeStr = ''
    let parsedCount = 0
    let found2097 = false
    let found7566 = false

    if (adsJobs.length > 0) {
      const rawVal = adsJobs[0].get('items')
      typeStr = typeof rawVal
      let arr = []
      if (Array.isArray(rawVal)) {
        arr = rawVal
      } else if (typeof rawVal === 'string') {
        try {
          arr = JSON.parse(rawVal)
        } catch (_) {}
      } else if (rawVal && typeof rawVal === 'object') {
        try {
          // Goja pode retornar slice ou map
          arr = Array.from(rawVal)
        } catch (_) {
          arr = rawVal
        }
      }

      parsedCount = Array.isArray(arr) ? arr.length : 0

      // String search no campo bruto
      const strVal = String(adsJobs[0].getString('items') || '')
      found2097 = strVal.includes('MLB2097858038')
      found7566 = strVal.includes('MLB7566367408')
    }

    const rec = app.findFirstRecordByData('ml_catalog_search_jobs', 'query', '__PROBE_0243_VIEW__')
    if (rec) {
      rec.set(
        'progress_text',
        'type: ' +
          typeStr +
          ' parsedCount: ' +
          parsedCount +
          ' found2097: ' +
          found2097 +
          ' found7566: ' +
          found7566,
      )
      app.save(rec)
    }
  },
  (app) => {},
)
