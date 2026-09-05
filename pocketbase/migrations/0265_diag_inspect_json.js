migrate(
  (app) => {
    // 0265: Inspecionar o item MLB7566367408 do último ml_ads_fetch_jobs
    const adsJobs = app.findRecordsByFilter(
      'ml_ads_fetch_jobs',
      "status = 'done' && items_count > 0",
      '-created',
      1,
      0,
    )
    const j = adsJobs[0]
    const rawItems = j.getString('items')
    const list = JSON.parse(rawItems)

    const diag = {
      total_items: list.length,
      sample_title: '',
      match_7566: null,
      match_2097: null,
      has_dell: 0,
      has_latitude: 0,
      has_5420: 0,
      has_all_three: 0,
    }

    for (let i = 0; i < list.length; i++) {
      const it = list[i]
      const text = (
        (it.title || '') +
        ' ' +
        (it.brand || '') +
        ' ' +
        (it.model || '') +
        ' ' +
        (it.catalog_product_id || '')
      ).toLowerCase()

      if (it.id === 'MLB7566367408' || String(it.catalog_product_id) === 'MLB2097858038') {
        diag.match_7566 = it
      }

      if (text.includes('dell')) diag.has_dell++
      if (text.includes('latitude')) diag.has_latitude++
      if (text.includes('5420')) diag.has_5420++
      if (text.includes('dell') && text.includes('latitude') && text.includes('5420')) {
        diag.has_all_three++
        diag.sample_title = it.title
      }
    }

    // Salvar em um search job para podermos ler com db_query
    const col = app.findCollectionByNameOrId('ml_catalog_search_jobs')
    const rec = new Record(col)
    rec.set('query', '__DIAG_0265__')
    rec.set('status', 'done')
    rec.set('progress_text', JSON.stringify(diag))
    app.save(rec)
  },
  (app) => {},
)
