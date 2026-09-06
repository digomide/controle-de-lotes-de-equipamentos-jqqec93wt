migrate(
  (app) => {
    const job = app.findRecordById('ml_competitor_jobs', 'wp8elpqepb1vao9')
    const rd = job.get('result_data') || {}

    const summary = {
      items_probe_status: rd.items_probe ? rd.items_probe.status : null,
      items_catalog_product_id:
        rd.items_probe && rd.items_probe.json ? rd.items_probe.json.catalog_product_id : null,
      items_catalog_listing:
        rd.items_probe && rd.items_probe.json ? rd.items_probe.json.catalog_listing : null,

      ptw_status: rd.price_to_win ? rd.price_to_win.status : null,
      ptw_json: rd.price_to_win ? rd.price_to_win.json : null,

      prod_cat_status: rd.product_catalog ? rd.product_catalog.status : null,
      prod_cat_bb:
        rd.product_catalog && rd.product_catalog.json
          ? rd.product_catalog.json.buy_box_winner
          : null,

      prod_items_status: rd.product_items ? rd.product_items.status : null,
      prod_items_json: rd.product_items ? rd.product_items.json : null,

      prod_ptw_status: rd.product_price_to_win ? rd.product_price_to_win.status : null,
      prod_ptw_json: rd.product_price_to_win ? rd.product_price_to_win.json : null,

      search_status: rd.search_catalog_product_id ? rd.search_catalog_product_id.status : null,
      search_total:
        rd.search_catalog_product_id &&
        rd.search_catalog_product_id.json &&
        rd.search_catalog_product_id.json.paging
          ? rd.search_catalog_product_id.json.paging.total
          : null,
      search_results_sample:
        rd.search_catalog_product_id &&
        rd.search_catalog_product_id.json &&
        Array.isArray(rd.search_catalog_product_id.json.results)
          ? rd.search_catalog_product_id.json.results
              .slice(0, 3)
              .map((r) => ({
                id: r.id,
                title: r.title,
                price: r.price,
                seller: r.seller,
                available_quantity: r.available_quantity,
              }))
          : null,
    }

    job.set('error_message', JSON.stringify(summary).substring(0, 2000))
    app.save(job)
  },
  (app) => {},
)
