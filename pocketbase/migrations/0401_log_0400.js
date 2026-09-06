migrate(
  (app) => {
    const testJob = app.findRecordById('ml_competitor_jobs', 'wp8elpqepb1vao9')
    const q = testJob.getString('query') || ''
    console.log('0400 query: ' + q)
  },
  (app) => {},
)
