migrate(
  (app) => {
    const job = app.findRecordById('ml_competitor_jobs', 'wp8elpqepb1vao9')
    const rawStr = job.getString('result_data')
    let parsed = null
    try {
      parsed = JSON.parse(rawStr)
    } catch (e) {
      job.set('error_message', 'JSON.parse fail: ' + e)
      app.save(job)
      return
    }

    const ptw = parsed.price_to_win ? parsed.price_to_win : {}
    const items = parsed.items_probe ? parsed.items_probe : {}
    const search = parsed.search_catalog_product_id ? parsed.search_catalog_product_id : {}

    const ptwInfo = {
      status: ptw.status,
      json: ptw.json,
    }
    const itemInfo = {
      status: items.status,
      catalog_product_id: items.json ? items.json.catalog_product_id : null,
      catalog_listing: items.json ? items.json.catalog_listing : null,
      condition: items.json ? items.json.condition : null,
    }
    const searchInfo = {
      status: search.status,
      total: search.json && search.json.paging ? search.json.paging.total : null,
      first_item:
        search.json && Array.isArray(search.json.results) && search.json.results[0]
          ? {
              id: search.json.results[0].id,
              title: search.json.results[0].title,
              price: search.json.results[0].price,
              seller: search.json.results[0].seller,
              available_quantity: search.json.results[0].available_quantity,
              listing_type_id: search.json.results[0].listing_type_id,
              shipping: search.json.results[0].shipping,
            }
          : null,
    }

    job.set(
      'error_message',
      JSON.stringify({ ptw: ptwInfo, item: itemInfo, search: searchInfo }).substring(0, 2000),
    )
    app.save(job)
  },
  (app) => {},
)
