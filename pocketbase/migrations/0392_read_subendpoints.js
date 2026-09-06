migrate(
  (app) => {
    const testJob = app.findRecordById('ml_competitor_jobs', 'wp8elpqepb1vao9')
    const err = testJob.getString('error_message') || ''
    const line = err.substring(0, 240)
    testJob.set('seller_nickname', line)
    app.save(testJob)
  },
  (app) => {},
)
