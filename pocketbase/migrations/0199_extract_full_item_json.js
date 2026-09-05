migrate(
  (app) => {
    const job = app.findRecordById('ml_ads_fetch_jobs', 'z3fjp5vccnmzyzx')
    const rawString = job.getString('items')
    const targetIdx = rawString.indexOf('MLB7566367408')
    // Encontrar o início do objeto {...} e o final
    const objStart = rawString.lastIndexOf('{', targetIdx)
    const objEnd = rawString.indexOf('}', targetIdx)
    const fullObjStr = rawString.substring(objStart, objEnd + 1)

    const checkCol = app.findCollectionByNameOrId('ml_ads_fetch_jobs')
    const reportRec = new Record(checkCol)
    reportRec.set('status', 'done')
    reportRec.set('status_filter', '__CHECK_FULL_OBJ__')
    reportRec.set('progress_text', 'Length: ' + fullObjStr.length)
    reportRec.set('error_message', fullObjStr)
    app.save(reportRec)
  },
  (app) => {},
)
