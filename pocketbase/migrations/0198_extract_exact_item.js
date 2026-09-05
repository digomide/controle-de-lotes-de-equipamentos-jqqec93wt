migrate(
  (app) => {
    const job = app.findRecordById('ml_ads_fetch_jobs', 'z3fjp5vccnmzyzx')
    const rawString = job.getString('items')
    const targetIdx = rawString.indexOf('MLB7566367408')
    let snippet = ''
    if (targetIdx !== -1) {
      const start = Math.max(0, targetIdx - 50)
      const end = Math.min(rawString.length, targetIdx + 450)
      snippet = rawString.substring(start, end)
    }

    const checkCol = app.findCollectionByNameOrId('ml_ads_fetch_jobs')
    const reportRec = new Record(checkCol)
    reportRec.set('status', 'done')
    reportRec.set('status_filter', '__CHECK_EXACT_ITEM__')
    reportRec.set('progress_text', 'Found at ' + targetIdx)
    reportRec.set('error_message', snippet)
    app.save(reportRec)
  },
  (app) => {},
)
