migrate(
  (app) => {
    // 0516_log_0515_result.js
    const recs = app.findRecordsByFilter(
      'ml_competitor_jobs',
      'query = "inspect_vars_price"',
      '-created',
      1,
      0,
    )
    if (!recs || recs.length === 0) return
    console.log('[0515_RESULT] ' + recs[0].getString('error_message'))
  },
  (app) => {},
)
