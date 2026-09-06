migrate(
  (app) => {
    const job = app.findRecordById('ml_competitor_jobs', 'wp8elpqepb1vao9')
    const raw = job.getString('error_message') || ''
    const data = JSON.parse(raw)
    const det = data.detailed || []

    const text = det
      .map(function (d) {
        return d.id + ': sold=' + d.sold_quantity + ' (' + d.status + ')'
      })
      .join(' | ')

    job.set('seller_nickname', text.substring(0, 250))
    app.save(job)
  },
  (app) => {},
)
