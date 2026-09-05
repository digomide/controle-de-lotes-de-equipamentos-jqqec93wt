migrate(
  (app) => {
    // 0089_check_0088_log.js
    const job = app.findFirstRecordByData('ml_competitor_jobs', 'query', 'direct_token_test')
    console.log('[0088_result] ' + job.getString('error_message'))
  },
  (app) => {},
)
