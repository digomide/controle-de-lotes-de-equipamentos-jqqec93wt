migrate(
  (app) => {
    const job = app.findRecordById('ml_competitor_jobs', 'wp8elpqepb1vao9')
    const rawStr = job.getString('result_data')
    const parsed = JSON.parse(rawStr)

    const w =
      parsed.price_to_win && parsed.price_to_win.json && parsed.price_to_win.json.winner
        ? parsed.price_to_win.json.winner
        : {}
    const summary = {
      winner_item_id: w.item_id,
      winner_price: w.price,
      winner_currency: w.currency_id,
      boosts_count: w.boosts ? w.boosts.length : 0,
      boosts: w.boosts,
    }

    job.set('error_message', JSON.stringify(summary).substring(0, 2000))
    app.save(job)
  },
  (app) => {},
)
