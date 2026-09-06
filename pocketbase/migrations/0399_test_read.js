migrate(
  (app) => {
    let token = ''
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (sRecords && sRecords.length > 0) {
      token = sRecords[0].getString('access_token')
    }

    const testJob = app.findRecordById('ml_competitor_jobs', 'wp8elpqepb1vao9')
    const nick = testJob.getString('seller_nickname') || ''
    // Apenas para vermos se a migração 0398 escreveu
    console.log('0398 nick: ' + nick)
  },
  (app) => {},
)
