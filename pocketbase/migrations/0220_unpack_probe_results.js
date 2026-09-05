migrate(
  (app) => {
    const job = app.findFirstRecordByData(
      'ml_ads_fetch_jobs',
      'status_filter',
      '__PROBE_REFURB_API__',
    )
    const fullJson = JSON.parse(job.getString('error_message'))

    // Salvar testResults separadamente para ler
    const col = app.findCollectionByNameOrId('ml_ads_fetch_jobs')
    for (let i = 0; i < fullJson.testResults.length; i++) {
      const tr = fullJson.testResults[i]
      const rec = new Record(col)
      rec.set('status', 'done')
      rec.set('status_filter', '__PROBE_TR_' + i + '__')
      rec.set(
        'progress_text',
        tr.name +
          ' total:' +
          tr.total +
          ' has2097:' +
          tr.has2097 +
          ' refurbCount:' +
          tr.refurbCount,
      )
      rec.set('error_message', JSON.stringify(tr))
      app.save(rec)
    }
  },
  (app) => {},
)
