migrate(
  (app) => {
    const job = app.findRecordById('ml_competitor_jobs', 'wp8elpqepb1vao9')
    const raw = job.getString('error_message') || ''
    const data = JSON.parse(raw)

    const compact = {
      p_keys: data.prodRes ? data.prodRes.keys : [],
      p_sold: data.prodRes ? data.prodRes.sold_quantity : null,
      p_bb: data.prodRes && data.prodRes.buy_box_winner ? data.prodRes.buy_box_winner.price : null,
      it_count: data.itemsRes ? data.itemsRes.count : 0,
      it_sum: data.itemsRes ? data.itemsRes.sumSold : 0,
      it_max: data.itemsRes ? data.itemsRes.maxSold : 0,
      s_total: data.searchRes ? data.searchRes.total : 0,
      s_sum: data.searchRes ? data.searchRes.sumSold : 0,
      ps_found: data.prodSearchRes ? data.prodSearchRes.found2097 : null,
      s_sample: data.searchRes && data.searchRes.sample ? data.searchRes.sample.slice(0, 3) : [],
    }

    job.set('query', JSON.stringify(compact).substring(0, 1000))
    app.save(job)
  },
  (app) => {},
)
