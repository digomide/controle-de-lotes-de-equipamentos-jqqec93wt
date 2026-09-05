migrate(
  (app) => {
    const job2 = app.findRecordById('ml_ads_fetch_jobs', 'wpuluyh1jzsa7pz')
    const rawString = job2.getString('items')
    const checkCol = app.findCollectionByNameOrId('ml_ads_fetch_jobs')
    const reportRec = new Record(checkCol)
    reportRec.set('status', 'done')
    reportRec.set('status_filter', '__CHECK_ML_DETAILS_STR__')
    reportRec.set('progress_text', rawString.substring(0, 500))
    app.save(reportRec)
  },
  (app) => {},
)
