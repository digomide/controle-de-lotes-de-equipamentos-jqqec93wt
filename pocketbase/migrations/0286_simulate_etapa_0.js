migrate(
  (app) => {
    const rec = app.findFirstRecordByFilter(
      'ml_ads_fetch_jobs',
      "status_filter = '__DIAG_INSPIRON_3576__'",
    )
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    let token = sRecords.length > 0 ? sRecords[0].getString('access_token') : ''

    // 1. Simular exatamente a Etapa 0 do ml_catalog_search_queue para query "dell inspiron 3576"
    // e condição "refurbished"
    const queryRaw = 'dell inspiron 3576'

    function tokenizeText(text) {
      if (!text) return []
      const clean = String(text)
        .toLowerCase()
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
      const stopWords = {
        notebook: 1,
        notebooks: 1,
        laptop: 1,
        laptops: 1,
        pc: 1,
        computador: 1,
        de: 1,
        da: 1,
        do: 1,
        para: 1,
        com: 1,
        e: 1,
        recondicionado: 1,
        usado: 1,
        novo: 1,
      }
      const words = clean.split(/\s+/).filter(Boolean)
      const filtered = words.filter(function (w) {
        return !stopWords[w]
      })
      return filtered.length > 0 ? filtered : words
    }

    const queryTokens = tokenizeText(queryRaw) // ['dell', 'inspiron', '3576']

    const adsJobs = app.findRecordsByFilter(
      'ml_ads_fetch_jobs',
      "status = 'done' && items_count > 0",
      '-created',
      1,
      0,
    )
    let rawAdsItems = adsJobs[0].getString('items') || adsJobs[0].get('items')
    let parsedAds = typeof rawAdsItems === 'string' ? JSON.parse(rawAdsItems) : rawAdsItems

    let matchedAdsInFetch = []
    for (let i = 0; i < parsedAds.length; i++) {
      const ad = parsedAds[i]
      if (!ad) continue
      const adTitle = String(ad.title || '').toLowerCase()
      const adBrand = String(ad.brand || '').toLowerCase()
      const adModel = String(ad.model || '').toLowerCase()
      const catId = String(ad.catalog_product_id || '').trim()
      const adText = adTitle + ' ' + adBrand + ' ' + adModel + ' ' + catId.toLowerCase()

      let matches = true
      for (let t = 0; t < queryTokens.length; t++) {
        if (adText.indexOf(queryTokens[t]) === -1) {
          matches = false
          break
        }
      }
      if (matches) {
        matchedAdsInFetch.push({
          id: ad.id,
          title: ad.title,
          catalog_product_id: ad.catalog_product_id,
          condition: ad.condition,
          condition_grade: ad.condition_grade,
        })
      }
    }

    rec.set(
      'progress_text',
      'queryTokens: ' +
        queryTokens.join(',') +
        ' | matchedAds: ' +
        matchedAdsInFetch.length +
        ' (catIds: ' +
        matchedAdsInFetch.map((a) => a.id + '->' + (a.catalog_product_id || 'EMPTY')).join('; ') +
        ')',
    )
    rec.set(
      'error_message',
      JSON.stringify({ queryTokens: queryTokens, matchedAds: matchedAdsInFetch }),
    )
    app.save(rec)
  },
  (app) => {},
)
