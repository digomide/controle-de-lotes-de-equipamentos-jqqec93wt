migrate(
  (app) => {
    // 0252: Testar se endpoint GET /products/MLB2097858038 tem parent_id ou siblings
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    const token = sRecords.length > 0 ? sRecords[0].getString('access_token') : ''

    const res = $http.send({
      url: 'https://api.mercadolibre.com/products/MLB2097858038',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 10,
    })

    let siblings = []
    let parentId = null
    if (res.statusCode === 200 && res.json) {
      parentId = res.json.parent_id
      if (parentId) {
        // Consultar o parent
        const pRes = $http.send({
          url: 'https://api.mercadolibre.com/products/' + parentId,
          method: 'GET',
          headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
          timeout: 10,
        })
        if (pRes.statusCode === 200 && pRes.json) {
          siblings = pRes.json.children_ids || []
        }
      }
    }

    const rec = app.findFirstRecordByData('ml_catalog_search_jobs', 'query', '__PROBE_0243_VIEW__')
    if (rec) {
      rec.set('strategy_used', 'probe_0252')
      rec.set(
        'progress_text',
        'parentId: ' +
          parentId +
          ' siblingsCount: ' +
          siblings.length +
          ' siblings: ' +
          siblings.slice(0, 5).join(','),
      )
      rec.set('raw_debug', [JSON.stringify({ parentId, siblings })])
      app.save(rec)
    }
  },
  (app) => {},
)
