migrate(
  (app) => {
    // 0514_print_to_console_item_details.js
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

    console.log(
      '[DEBUG_ITEM_5195] id=' +
        body.id +
        ' title=' +
        body.title +
        ' seller_id=' +
        body.seller_id +
        ' catalog_listing=' +
        body.catalog_listing +
        ' catalog_product_id=' +
        body.catalog_product_id +
        ' variations_len=' +
        (body.variations ? body.variations.length : 0) +
        ' tags=' +
        JSON.stringify(body.tags) +
        ' channels=' +
        JSON.stringify(body.channels),
    )

    if (body.variations && body.variations.length > 0) {
      console.log(
        '[DEBUG_ITEM_5195] var0_id=' +
          body.variations[0].id +
          ' var0_price=' +
          body.variations[0].price +
          ' var0_qty=' +
          body.variations[0].available_quantity,
      )
    }
  },
  (app) => {},
)
