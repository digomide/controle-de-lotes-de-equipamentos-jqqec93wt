migrate(
  (app) => {
    // 0091_log_job_error.js
    const job = app.findFirstRecordByData('ml_competitor_jobs', 'query', 'direct_token_test')
    console.log('[0090_output] ' + job.getString('error_message'))
  },
  (app) => {},
)
