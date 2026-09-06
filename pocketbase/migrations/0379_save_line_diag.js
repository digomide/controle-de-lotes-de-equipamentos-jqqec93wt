migrate(
  (app) => {
    const job = app.findRecordById('ml_competitor_jobs', 'wp8elpqepb1vao9')
    const raw = job.getString('error_message') || ''
    const data = JSON.parse(raw)

    // Formata em string curta:
    // Exemplo: p_sold: null | it_count: X | it_sum: Y | it_max: Z | s_total: W | s_sum: K
    const line = [
      'p_sold=' + (data.prodRes ? data.prodRes.sold_quantity : 'null'),
      'it_count=' + (data.itemsRes ? data.itemsRes.count : 0),
      'it_sum=' + (data.itemsRes ? data.itemsRes.sumSold : 0),
      'it_max=' + (data.itemsRes ? data.itemsRes.maxSold : 0),
      's_total=' + (data.searchRes ? data.searchRes.total : 0),
      's_sum=' + (data.searchRes ? data.searchRes.sumSold : 0),
      's_cnt=' + (data.searchRes ? data.searchRes.count : 0),
      'ps_2097=' +
        (data.prodSearchRes && data.prodSearchRes.found2097
          ? JSON.stringify(data.prodSearchRes.found2097)
          : 'not_found'),
    ].join(' | ')

    job.set('seller_nickname', line.substring(0, 250))
    app.save(job)
  },
  (app) => {},
)
