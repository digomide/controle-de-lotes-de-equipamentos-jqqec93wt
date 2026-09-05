migrate(
  (app) => {
    const job = app.findRecordById('ml_ads_fetch_jobs', 'z3fjp5vccnmzyzx')
    const rawItems = job.get('items') || []
    let found = null
    for (let i = 0; i < rawItems.length; i++) {
      if (rawItems[i].id === 'MLB7566367408') {
        found = rawItems[i]
        break
      }
    }

    // Gravar resultado do achado em outro campo ou num registro auxiliar
    const checkCol = app.findCollectionByNameOrId('ml_ads_fetch_jobs')
    const reportRec = new Record(checkCol)
    reportRec.set('status', 'done')
    reportRec.set('status_filter', '__CHECK_RESULT__')
    reportRec.set('items_count', found ? 1 : 0)
    reportRec.set('progress_text', found ? 'FOUND: ' + JSON.stringify(found) : 'NOT FOUND')
    reportRec.set('items', found ? [found] : [])
    app.save(reportRec)
  },
  (app) => {},
)
