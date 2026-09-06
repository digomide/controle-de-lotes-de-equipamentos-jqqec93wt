migrate(
  (app) => {
    const testJob = app.findRecordById('ml_competitor_jobs', 'wp8elpqepb1vao9')
    const raw = testJob.getString('error_message') || ''
    const data = JSON.parse(raw)
    const snip = data.listSnippet || ''
    testJob.set('query', snip.substring(0, 1000))
    app.save(testJob)
  },
  (app) => {},
)
