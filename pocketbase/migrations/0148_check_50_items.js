migrate(
  (app) => {
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    const token = sRecords[0].getString('access_token')

    const res = $http.send({
      url: 'https://api.mercadolibre.com/products/search?status=active&site_id=MLB&domain_id=MLB-NOTEBOOKS&q=dell%20latitude%203420&limit=50&offset=0',
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/json',
      },
      timeout: 10,
    })

    let foundConditions = []
    if (res.statusCode === 200 && res.json && res.json.results) {
      for (let i = 0; i < res.json.results.length; i++) {
        const p = res.json.results[i]
        let itemCondAttr = null
        if (p.attributes) {
          for (let a = 0; a < p.attributes.length; a++) {
            const at = p.attributes[a]
            if (at.id === 'ITEM_CONDITION' || at.id === 'CONDITION') {
              itemCondAttr = at
            }
          }
        }
        let bbCond = p.buy_box_winner ? p.buy_box_winner.condition : null
        let rootCond = p.condition || null
        if (itemCondAttr || bbCond || rootCond) {
          foundConditions.push({
            id: p.id,
            name: (p.name || '').substring(0, 30),
            itemCondAttr: itemCondAttr,
            bbCond: bbCond,
            rootCond: rootCond,
          })
        }
      }
    }

    const job = app.findFirstRecordByData('ml_catalog_search_jobs', 'id', 'szg3o742i7qawmh')
    job.set(
      'error_message',
      JSON.stringify({
        totalIn50WithCond: foundConditions.length,
        found: foundConditions.slice(0, 5),
      }),
    )
    app.save(job)
  },
  (app) => {},
)
