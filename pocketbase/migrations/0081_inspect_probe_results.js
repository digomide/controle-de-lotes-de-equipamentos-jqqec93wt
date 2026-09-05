migrate(
  (app) => {
    // 0081_inspect_probe_results.js
    const job = app.findFirstRecordByData('ml_competitor_jobs', 'query', 'probe_multiget_items')
    const rd = job.get('result_data') || {}
    console.log('[probe] withToken: ' + JSON.stringify(rd.withToken))
    console.log('[probe] single_MLB4709060403: ' + JSON.stringify(rd.single_MLB4709060403))
    console.log('[probe] single_MLB2752099689: ' + JSON.stringify(rd.single_MLB2752099689))
  },
  (app) => {},
)
