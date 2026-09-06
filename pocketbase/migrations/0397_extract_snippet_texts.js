migrate(
  (app) => {
    let token = ''
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (sRecords && sRecords.length > 0) {
      token = sRecords[0].getString('access_token')
    }

    const testJob = app.findRecordById('ml_competitor_jobs', 'wp8elpqepb1vao9')
    const snip = testJob.getString('query') || ''
    // Buscar todas as tags de texto ou spans dentro de snip
    const texts = snip.match(/>([^<]+)</g) || []
    const cleanTexts = texts
      .map(function (t) {
        return t.replace(/[><]/g, '').trim()
      })
      .filter(function (t) {
        return t.length > 0
      })

    testJob.set('seller_nickname', cleanTexts.slice(0, 15).join(' | ').substring(0, 240))
    app.save(testJob)
  },
  (app) => {},
)
