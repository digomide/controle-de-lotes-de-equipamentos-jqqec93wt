migrate(
  (app) => {
    const job2 = app.findRecordById('ml_ads_fetch_jobs', 'wpuluyh1jzsa7pz')
    const checkCol = app.findCollectionByNameOrId('ml_ads_fetch_jobs')
    const reportRec = new Record(checkCol)
    reportRec.set('status', 'done')
    reportRec.set('status_filter', '__CHECK_ML_DETAILS__')
    reportRec.set('items_count', 1)
    const it = (job2.get('items') || [])[0]
    reportRec.set('progress_text', it ? JSON.stringify(it).substring(0, 500) : 'empty')
    reportRec.set('items', it ? [it] : [])
    app.save(reportRec)
  },
  (app) => {},
)
