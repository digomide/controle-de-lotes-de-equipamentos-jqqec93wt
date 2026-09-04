migrate(
  (app) => {
    let settings = null
    try {
      const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
      if (sRecords && sRecords.length > 0) settings = sRecords[0]
    } catch (_) {}
    const accessToken = settings ? settings.getString('access_token') : ''

    // Pegar o último item de ml_publish_queue
    const qRecords = app.findRecordsByFilter('ml_publish_queue', '1=1', '-created', 1, 0)
    if (qRecords && qRecords.length > 0) {
      const rec = qRecords[0]
      console.log('VALIDATION RESULT SUMMARY:', rec.getString('error_message'))
    }
  },
  (app) => {},
)
