migrate(
  (app) => {
    // 0333_inspect_items_detail.js
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (!sRecords || sRecords.length === 0) return
    const token = sRecords[0].getString('access_token')

    // Consultar detalhes completos de MLB7566367408 e do produto MLB2097858038
    const itemRes = $http.send({
      url: 'https://api.mercadolibre.com/items/MLB7566367408',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 10,
    })

    const prodRes = $http.send({
      url: 'https://api.mercadolibre.com/products/MLB2097858038',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 10,
    })

    const it = itemRes.json || {}
    const pr = prodRes.json || {}

    const col = app.findCollectionByNameOrId('ml_ads_fetch_jobs')
    const diag = new Record(col)
    diag.set('status', 'done')
    diag.set('status_filter', '__PERICIA_0333__')
    diag.set(
      'progress_text',
      'item: ' +
        it.id +
        ' cond:' +
        it.condition +
        ' cat:' +
        it.catalog_product_id +
        ' prod_cond:' +
        pr.condition,
    )
    diag.set(
      'error_message',
      JSON.stringify({
        item: {
          id: it.id,
          title: it.title,
          condition: it.condition,
          catalog_product_id: it.catalog_product_id,
          catalog_listing: it.catalog_listing,
          listing_type_id: it.listing_type_id,
          category_id: it.category_id,
          domain_id: it.domain_id,
          date_created: it.date_created,
          parent_item_id: it.parent_item_id,
          attributes: it.attributes,
          sale_terms: it.sale_terms,
        },
        prod: {
          id: pr.id,
          name: pr.name,
          parent_id: pr.parent_id,
          children_ids: pr.children_ids,
          condition: pr.condition,
          status: pr.status,
          attributes: (pr.attributes || []).map((a) => ({
            id: a.id,
            value_id: a.value_id,
            value_name: a.value_name,
          })),
        },
      }).substring(0, 4900),
    )
    app.save(diag)
  },
  (app) => {},
)
