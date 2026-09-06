migrate(
  (app) => {
    const job = app.findRecordById('ml_competitor_jobs', 'wp8elpqepb1vao9')
    const raw = job.getString('error_message')
    try {
      const p = JSON.parse(raw)
      const summary = {
        item0_sold_quantity: p.item0_sold_quantity,
        prod_sold_quantity: p.product_api_sold_quantity,
        prod_bb_winner_keys: p.product_api_bb_winner ? Object.keys(p.product_api_bb_winner) : null,
        prod_bb_winner_sold: p.product_api_bb_winner ? p.product_api_bb_winner.sold_quantity : null,
        item0_keys: p.item0_keys ? p.item0_keys.slice(0, 15) : null,
      }
      job.set('error_message', JSON.stringify(summary))
      app.save(job)
    } catch (_) {}
  },
  (app) => {},
)
