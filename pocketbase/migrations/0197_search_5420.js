migrate(
  (app) => {
    const job = app.findRecordById('ml_ads_fetch_jobs', 'z3fjp5vccnmzyzx')
    const rawString = job.getString('items')
    const hasId = rawString.includes('MLB7566367408')
    const has7566 = rawString.includes('7566367408')

    // Buscar itens que contenham "5420"
    let idx = 0
    const matches = []
    while ((idx = rawString.indexOf('5420', idx)) !== -1 && matches.length < 5) {
      const start = Math.max(0, idx - 100)
      const end = Math.min(rawString.length, idx + 100)
      matches.push(rawString.substring(start, end))
      idx += 4
    }

    const checkCol = app.findCollectionByNameOrId('ml_ads_fetch_jobs')
    const reportRec = new Record(checkCol)
    reportRec.set('status', 'done')
    reportRec.set('status_filter', '__CHECK_SEARCH_5420__')
    reportRec.set(
      'progress_text',
      'hasId=' + hasId + ', has7566=' + has7566 + ' matches=' + matches.length,
    )
    reportRec.set('error_message', matches.join(' |---| ').substring(0, 500))
    app.save(reportRec)
  },
  (app) => {},
)
