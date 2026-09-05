migrate(
  (app) => {
    // 0266: Salvar o diag no campo error_message de um registro já existente para não acionar o hook
    const rec = app.findRecordById('ml_catalog_search_jobs', 'l077xtfs7tql82h')

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
        diag.match_7566 = {
          id: it.id,
          title: it.title,
          brand: it.brand,
          model: it.model,
          catalog_product_id: it.catalog_product_id,
          condition: it.condition,
          condition_grade: it.condition_grade,
        }
      }

      if (text.includes('dell')) diag.has_dell++
      if (text.includes('latitude')) diag.has_latitude++
      if (text.includes('5420')) diag.has_5420++
      if (text.includes('dell') && text.includes('latitude') && text.includes('5420')) {
        diag.has_all_three++
        diag.sample_title = it.title
      }
    }

    rec.set('error_message', JSON.stringify(diag))
    app.save(rec)
  },
  (app) => {},
)
