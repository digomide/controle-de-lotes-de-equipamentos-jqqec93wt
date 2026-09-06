migrate(
  (app) => {
    const job = app.findRecordById('ml_competitor_jobs', 'wp8elpqepb1vao9')
    const rawStr = job.getString('result_data')
    const parsed = JSON.parse(rawStr)

    const ptw = parsed.price_to_win ? parsed.price_to_win.json : {}
    job.set('error_message', JSON.stringify(ptw.winner).substring(0, 2000))
    app.save(job)
  },
  (app) => {},
)
