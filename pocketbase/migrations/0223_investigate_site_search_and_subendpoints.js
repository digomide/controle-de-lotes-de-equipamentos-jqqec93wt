migrate(
  (app) => {
    // 1. Carregar token ML
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    const token = sRecords[0].getString('access_token')

    // 2. Investigar endpoints da API do ML:
    // a) GET /sites/MLB/search?q=dell latitude 5420 recondicionado
    // b) GET /sites/MLB/search?q=dell latitude 5420&ITEM_CONDITION=2230581
    // c) GET /products/MLB2097858038
    // d) GET /products/MLB2097858038/items
    // e) GET /products/MLB2097858038/children
    // f) GET /products/MLB2097858038/parent

    const calls = [
      {
        name: 'site_search_q_refurb',
        url: 'https://api.mercadolibre.com/sites/MLB/search?q=dell%20latitude%205420%20recondicionado&limit=20',
      },
      {
        name: 'site_search_q_item_cond',
        url: 'https://api.mercadolibre.com/sites/MLB/search?q=dell%20latitude%205420&ITEM_CONDITION=2230581&limit=20',
      },
      { name: 'prod_items', url: 'https://api.mercadolibre.com/products/MLB2097858038/items' },
      {
        name: 'prod_children',
        url: 'https://api.mercadolibre.com/products/MLB2097858038/children',
      },
      { name: 'prod_parent', url: 'https://api.mercadolibre.com/products/MLB2097858038/parent' },
      { name: 'prod_reviews', url: 'https://api.mercadolibre.com/reviews/item/MLB2097858038' },
    ]

    const col = app.findCollectionByNameOrId('ml_ads_fetch_jobs')

    for (let c = 0; c < calls.length; c++) {
      try {
        const res = $http.send({
          url: calls[c].url,
          method: 'GET',
          headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
          timeout: 10,
        })
        const rec = new Record(col)
        rec.set('status', 'done')
        rec.set('status_filter', '__INVESTIGATE_' + c + '__')

        let info = 'status: ' + res.statusCode
        let catalogIdsFound = []
        if (res.statusCode === 200 && res.json) {
          if (Array.isArray(res.json.results)) {
            // site search results
            for (let r = 0; r < res.json.results.length; r++) {
              const item = res.json.results[r]
              if (item.catalog_product_id) {
                catalogIdsFound.push(
                  item.catalog_product_id +
                    (item.catalog_product_id === 'MLB2097858038' ? ' (*MATCH*)' : ''),
                )
              }
            }
            info +=
              ' results:' +
              res.json.results.length +
              ' catalogIds:' +
              catalogIdsFound.length +
              ' has2097:' +
              catalogIdsFound.some((s) => s.includes('MLB2097858038'))
          } else {
            info += ' keys:' + Object.keys(res.json).join(',')
          }
        }
        rec.set('progress_text', calls[c].name + ' -> ' + info)
        rec.set(
          'error_message',
          JSON.stringify({
            name: calls[c].name,
            statusCode: res.statusCode,
            catalogIds: catalogIdsFound,
            bodySample: JSON.stringify(res.json || {}).substring(0, 1000),
          }).substring(0, 3990),
        )
        app.save(rec)
      } catch (err) {
        const rec = new Record(col)
        rec.set('status', 'done')
        rec.set('status_filter', '__INVESTIGATE_' + c + '__')
        rec.set('progress_text', calls[c].name + ' -> err: ' + String(err))
        app.save(rec)
      }
    }
  },
  (app) => {},
)
