migrate(
  (app) => {
    const job = app.findFirstRecordByData('ml_catalog_search_jobs', 'id', 'szg3o742i7qawmh')
    const msg = JSON.parse(job.getString('error_message') || '{}')
    const attrs = msg.details ? msg.details.attributes : []
    const attrIds = attrs.map((a) => a.id)

    job.set(
      'error_message',
      JSON.stringify({
        attrCount: attrs.length,
        attrIds: attrIds,
        conditionAttrs: attrs.filter((a) => a.id.indexOf('COND') >= 0 || a.id.indexOf('ITEM') >= 0),
      }),
    )
    app.save(job)
  },
  (app) => {},
)
