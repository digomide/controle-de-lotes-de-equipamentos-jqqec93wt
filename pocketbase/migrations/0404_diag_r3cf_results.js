migrate(
  (app) => {
    const job = app.findRecordById('ml_catalog_search_jobs', 'r3cfjoogqnewvtn')
    if (!job) {
      app.save(
        new Record(app.findCollectionByNameOrId('purchase_batches'), { notes: 'Job not found' }),
      )
      return
    }
    const results = job.get('results')
    let list = []
    if (Array.isArray(results)) {
      list = results
    } else if (typeof results === 'string') {
      try {
        list = JSON.parse(results)
      } catch (_) {}
    }

    // Estatísticas
    let m900Count = 0
    let m900Titles = []
    let allTitlesSample = []

    for (let i = 0; i < list.length; i++) {
      const t = String(list[i].title || '')
      if (i < 20) allTitlesSample.push(t)
      if (t.toLowerCase().includes('m900')) {
        m900Count++
        if (m900Titles.length < 25) m900Titles.push(t)
      }
    }

    // Grava o relatório no error_message do job para não poluir outra tabela
    const summaryMsg =
      'TOTAL_RESULTS=' +
      list.length +
      ' | M900_COUNT=' +
      m900Count +
      ' | TITLES_M900=' +
      JSON.stringify(m900Titles) +
      ' | FIRST_20=' +
      JSON.stringify(allTitlesSample)
    job.set('error_message', summaryMsg.substring(0, 4000))
    app.save(job)
  },
  (app) => {},
)
