migrate(
  (app) => {
    // 0082_inspect_withtoken_field.js
    const job = app.findFirstRecordByData('ml_competitor_jobs', 'query', 'probe_multiget_items')
    const rd = job.get('result_data') || {}
    job.set(
      'error_message',
      JSON.stringify({
        withToken: rd.withToken,
        s47: rd.single_MLB4709060403,
        s27: rd.single_MLB2752099689,
      }).substring(0, 500),
    )
    app.save(job)
  },
  (app) => {},
)
