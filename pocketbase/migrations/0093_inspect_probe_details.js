migrate(
  (app) => {
    // 0093_inspect_probe_details.js
    const job = app.findFirstRecordByData(
      'ml_competitor_jobs',
      'query',
      'probe_mlb_sources_2010941196',
    )
    const rd = job.get('result_data')
    console.log('[PROBE 93] productAuth: ' + JSON.stringify(rd.productEndpointAuth))
    console.log('[PROBE 93] realPage: ' + JSON.stringify(rd.realPage))
  },
  (app) => {},
)
