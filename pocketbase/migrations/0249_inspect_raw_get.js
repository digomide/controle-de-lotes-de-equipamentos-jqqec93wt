migrate(
  (app) => {
    // 0249: Testar consulta direta na API de itens do vendedor ou inspeção do raw JSON
    const rec = app.findFirstRecordByData('ml_catalog_search_jobs', 'query', '__PROBE_0243_VIEW__')
    const adsJobs = app.findRecordsByFilter(
      'ml_ads_fetch_jobs',
      "status = 'done' && items_count > 0",
      '-created',
      1,
      0,
    )

    let info = ''
    if (adsJobs.length > 0) {
      const j = adsJobs[0]
      // Testar j.get('items') vs j.getString('items')
      const valGet = j.get('items')
      const isArr = Array.isArray(valGet)
      const len = isArr ? valGet.length : 0
      info += 'isArr=' + isArr + ' len=' + len + ' '
      if (len > 0) {
        const first = valGet[0]
        info += 'firstId=' + (first ? first.id : 'null') + ' '
      }
      // Verificar se o item MLB7566367408 está dentro de valGet
      if (isArr) {
        let match7566 = false
        for (let x = 0; x < valGet.length; x++) {
          if (valGet[x] && valGet[x].id === 'MLB7566367408') {
            match7566 = true
            info += 'FOUND_7566_IN_ARR! catId=' + valGet[x].catalog_product_id + ' '
            break
          }
        }
        info += 'match7566=' + match7566 + ' '
      }
    }

    if (rec) {
      rec.set('progress_text', info)
      app.save(rec)
    }
  },
  (app) => {},
)
