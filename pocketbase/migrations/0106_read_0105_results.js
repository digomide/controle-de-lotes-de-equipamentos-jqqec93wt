migrate(
  (app) => {
    // 0106_read_0105_results.js
    const job = app.findFirstRecordByData(
      'ml_competitor_jobs',
      'query',
      'probe_mlb_sources_2010941196',
    )
    console.log('[OUTPUT 0105] ' + job.getString('error_message'))
  },
  (app) => {},
)
