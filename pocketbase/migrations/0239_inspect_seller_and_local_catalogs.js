migrate(
  (app) => {
    // 1. Carregar token ML
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    const token = sRecords[0].getString('access_token')

    // 2. Anúncios do vendedor salvos localmente em ml_ads_fetch_jobs:
    const adsJobs = app.findRecordsByFilter(
      'ml_ads_fetch_jobs',
      "status = 'done' && items_count > 0",
      '-created',
      1,
      0,
    )
    let catalogAdsFromSeller = []
    if (adsJobs.length > 0) {
      const items = adsJobs[0].get('items') || []
      for (let i = 0; i < items.length; i++) {
        if (items[i].catalog_product_id) {
          catalogAdsFromSeller.push({
            id: items[i].id,
            title: items[i].title,
            catalog_product_id: items[i].catalog_product_id,
            catalog_listing: items[i].catalog_listing,
            condition: items[i].condition,
          })
        }
      }
    }

    // 3. E na tabela `products` do próprio sistema:
    const localProducts = app.findRecordsByFilter('products', "catalog_product_id != ''", '', 50, 0)
    const localWithCatalog = localProducts.map((p) => ({
      id: p.id,
      name: p.getString('name'),
      model: p.getString('model'),
      catalog_product_id: p.getString('catalog_product_id'),
      ml_listing_id: p.getString('ml_listing_id'),
    }))

    const job = app.findFirstRecordByData('ml_catalog_search_jobs', 'id', '85b8nijw2kay6k3')
    job.set(
      'progress_text',
      'catalogAdsFromSeller: ' +
        catalogAdsFromSeller.length +
        ' localWithCatalog: ' +
        localWithCatalog.length,
    )
    job.set(
      'error_message',
      JSON.stringify({
        sellerAdsSample: catalogAdsFromSeller.slice(0, 5),
        localCatalogSample: localWithCatalog.slice(0, 5),
      }),
    )
    app.save(job)
  },
  (app) => {},
)
