migrate(
  (app) => {
    const job = app.findFirstRecordByData('ml_catalog_search_jobs', 'id', 'szg3o742i7qawmh')
    const msg = JSON.parse(job.getString('error_message') || '{}')

    job.set(
      'error_message',
      JSON.stringify({
        itemsEndpoint: msg.itemsEndpoint,
        detail_settings: msg.detail_settings,
        sampleAttrs: (msg.detail_attrs || []).slice(0, 15),
      }),
    )
    app.save(job)
  },
  (app) => {},
)
