migrate(
  (app) => {
    // 0513_inspect_mlb5195337721_full_attrs.js
    let settings = null
    try {
      const sRecords = app.findRecordsByFilter(
        'ml_settings',
        'tenant_id = "ambicorpmestre1"',
        '-created',
        1,
        0,
      )
      if (sRecords && sRecords.length > 0) settings = sRecords[0]
    } catch (_) {}
    if (!settings) return
    const accessToken = settings.getString('access_token')

    const g = $http.send({
      url: 'https://api.mercadolibre.com/items/MLB5195337721',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + accessToken },
      timeout: 15,
    })
    const body = g.json || {}

    const col = app.findCollectionByNameOrId('ml_competitor_jobs')
    const rec = new Record(col)
    rec.set('action', 'search_query')
    rec.set('status', 'done')
    rec.set('query', 'inspect_item_body')
    rec.set(
      'error_message',
      JSON.stringify({
        id: body.id,
        title: body.title,
        seller_id: body.seller_id,
        catalog_listing: body.catalog_listing,
        catalog_product_id: body.catalog_product_id,
        parent_item_id: body.parent_item_id,
        listing_type_id: body.listing_type_id,
        variations: (body.variations || []).map((v) => ({
          id: v.id,
          price: v.price,
          avail_qty: v.available_quantity,
          attrs: v.attribute_combinations,
        })),
        channels: body.channels,
        sub_status: body.sub_status,
        tags: body.tags,
      }).substring(0, 1000),
    )
    app.save(rec)
  },
  (app) => {},
)
