migrate(
  (app) => {
    const job = app.findRecordById('ml_competitor_jobs', 'wp8elpqepb1vao9')
    const rawStr = job.getString('result_data')
    const parsed = JSON.parse(rawStr)

    const ptw = parsed.price_to_win ? parsed.price_to_win.json : {}
    // Dump winner and key fields
    const ptwClean = {
      item_id: ptw.item_id,
      current_price: ptw.current_price,
      price_to_win: ptw.price_to_win,
      status: ptw.status,
      catalog_product_id: ptw.catalog_product_id,
      winner: ptw.winner,
      competitors_sharing_first_place: ptw.competitors_sharing_first_place,
      visit_share: ptw.visit_share,
      reason: ptw.reason,
    }

    job.set('error_message', JSON.stringify(ptwClean).substring(0, 2000))
    app.save(job)
  },
  (app) => {},
)
