migrate(
  (app) => {
    // 0510_unpack_mlb5195337721_diag.js
    const jobRecs = app.findRecordsByFilter(
      'ml_competitor_jobs',
      'query = "diag_mlb5195337721"',
      '-created',
      1,
      0,
    )
    if (!jobRecs || jobRecs.length === 0) return
    const j = jobRecs[0]
    const data = j.get('result_data')

    const getBody = data.get?.body || {}
    const putBody = data.put?.body || {}
    const getStatus = data.get?.status
    const putStatus = data.put?.status

    const col = app.findCollectionByNameOrId('ml_competitor_jobs')
    const summaryJob = new Record(col)
    summaryJob.set('action', 'search_query')
    summaryJob.set('status', 'done')
    summaryJob.set('query', 'summary_mlb5195337721')
    summaryJob.set('result_data', {
      getStatus: getStatus,
      getItemSellerId: getBody.seller_id,
      getItemCatalogListing: getBody.catalog_listing,
      getItemCatalogProductId: getBody.catalog_product_id,
      getItemStatus: getBody.status,
      getItemListingTypeId: getBody.listing_type_id,
      getItemPrice: getBody.price,
      getItemVariationsCount: Array.isArray(getBody.variations) ? getBody.variations.length : 0,
      getItemVariations: (getBody.variations || []).map((v) => ({
        id: v.id,
        price: v.price,
        status: v.status,
        available_quantity: v.available_quantity,
      })),
      putStatus: putStatus,
      putBody: putBody,
    })
    app.save(summaryJob)
  },
  (app) => {},
)
