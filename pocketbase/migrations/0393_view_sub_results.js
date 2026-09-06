migrate(
  (app) => {
    const testJob = app.findRecordById('ml_competitor_jobs', 'wp8elpqepb1vao9')
    const err = testJob.getString('error_message') || ''
    try {
      const data = JSON.parse(err)
      const sub = data.subRes || {}
      const text = Object.keys(sub)
        .map(function (k) {
          return k + ':' + sub[k].status + '(' + (sub[k].keys || []).join(',') + ')'
        })
        .join(' | ')
      testJob.set('seller_nickname', text.substring(0, 240))
      app.save(testJob)
    } catch (_) {}
  },
  (app) => {},
)
