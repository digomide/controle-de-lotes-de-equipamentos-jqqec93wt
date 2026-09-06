migrate(
  (app) => {
    const jobs = app.findRecordsByFilter(
      'ml_competitor_jobs',
      "query = 'FINAL_DIAGNOSTIC_SUMMARY'",
      '-created',
      1,
      0,
    )
    if (jobs && jobs.length > 0) {
      const job = jobs[0]
      const rd = job.get('result_data') || {}
      const c1 = rd.catalog_items_2010733747 || {}
      const ptw = rd.price_to_win || {}
      const c2 = rd.catalog_items_18732668 || {}

      // Formatar uma string legível curta
      let msg =
        'PTW: ' +
        (ptw.status || '') +
        ' ptw=' +
        (ptw.price_to_win || '') +
        ' w_price=' +
        (ptw.winner ? ptw.winner.price : '') +
        ' w_id=' +
        (ptw.winner ? ptw.winner.item_id : '') +
        ' | '

      if (Array.isArray(c1.results)) {
        msg += 'CAT2010733747 (' + c1.results.length + '): '
        c1.results.forEach((it) => {
          msg +=
            '[' +
            it.item_id +
            ' R$' +
            it.price +
            ' qty:' +
            it.available_quantity +
            ' type:' +
            it.listing_type_id +
            ' bb:' +
            it.is_buy_box_winner +
            ' s:' +
            it.seller_id +
            '] '
        })
      }

      if (Array.isArray(c2.results)) {
        msg += ' | CAT18732668 (' + c2.results.length + '): '
        c2.results.forEach((it) => {
          msg +=
            '[' +
            it.item_id +
            ' R$' +
            it.price +
            ' qty:' +
            it.available_quantity +
            ' type:' +
            it.listing_type_id +
            ' bb:' +
            it.is_buy_box_winner +
            '] '
        })
      }

      job.set('error_message', msg.substring(0, 1900))
      app.save(job)
    }
  },
  (app) => {},
)
