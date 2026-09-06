migrate(
  (app) => {
    let token = ''
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (sRecords && sRecords.length > 0) {
      token = sRecords[0].getString('access_token')
    }

    const testJob = app.findRecordById('ml_competitor_jobs', 'wp8elpqepb1vao9')
    const nick = testJob.getString('seller_nickname') || ''

    // Procurar o record 1w5dc5e3ihxncio de ml_catalog_search_jobs
    let cat2097 = null
    try {
      const searchJob = app.findRecordById('ml_catalog_search_jobs', '1w5dc5e3ihxncio')
      const res = searchJob.get('results') || []
      const arr = typeof res === 'string' ? JSON.parse(res) : res
      const f = arr.find(function (x) {
        return x.catalog_product_id === 'MLB2097858038' || x.id === 'MLB2097858038'
      })
      if (f) {
        cat2097 = {
          id: f.id,
          cat: f.catalog_product_id,
          title: f.title,
          sold: f.sold_quantity,
          is_own: f.is_own_account,
        }
      }
    } catch (e) {
      cat2097 = { err: String(e) }
    }

    testJob.set('query', JSON.stringify({ nick: nick, cat2097: cat2097 }).substring(0, 1000))
    app.save(testJob)
  },
  (app) => {},
)
