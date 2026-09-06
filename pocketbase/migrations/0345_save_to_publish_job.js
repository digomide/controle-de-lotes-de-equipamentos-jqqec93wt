migrate(
  (app) => {
    // 0345_save_to_publish_job.js
    const recs = app.findRecordsByFilter(
      'ml_ads_fetch_jobs',
      "status_filter='__PERICIA_0343__'",
      '-created',
      1,
      0,
    )
    if (recs && recs.length > 0) {
      const pubCol = app.findCollectionByNameOrId('ml_catalog_publish_jobs')
      const pubJob = new Record(pubCol)
      pubJob.set('status', 'done')
      pubJob.set('status_code', 200)
      pubJob.set('catalog_product_id', 'MLB18732668')
      pubJob.set('price', 9999)
      pubJob.set('quantity', 1)
      pubJob.set('condition', 'refurbished')
      pubJob.set('error_message', recs[0].getString('progress_text'))
      pubJob.set('ml_listing_id', recs[0].getString('error_message').substring(0, 255))
      app.save(pubJob)
    }
  },
  (app) => {},
)
