migrate(
  (app) => {
    // 0268: Inspecionar o item 0 e os itens próprios do job 6pvxq95tk84npc0
    const job = app.findRecordById('ml_catalog_search_jobs', '6pvxq95tk84npc0')
    const rawResults = job.getString('results')
    const results = JSON.parse(rawResults)

    const ownItems = results.filter((r) => r.is_own_account)
    const mlb2097 = results.find((r) => r.catalog_product_id === 'MLB2097858038')

    const summary = {
      job_id: job.id,
      total_results: results.length,
      own_items_count: ownItems.length,
      first_item_catalog_id: results[0] ? results[0].catalog_product_id : null,
      first_item_is_own: results[0] ? results[0].is_own_account : null,
      first_item_title: results[0] ? results[0].title : null,
      first_item_condition: results[0] ? results[0].condition : null,
      first_item_grade: results[0] ? results[0].condition_grade : null,
      first_item_own_ad_id: results[0] ? results[0].own_ad_id : null,
      mlb2097_found: !!mlb2097,
      mlb2097_details: mlb2097
        ? {
            catalog_product_id: mlb2097.catalog_product_id,
            title: mlb2097.title,
            condition: mlb2097.condition,
            condition_grade: mlb2097.condition_grade,
            is_own_account: mlb2097.is_own_account,
            own_ad_id: mlb2097.own_ad_id,
            buy_box_winner_price: mlb2097.buy_box_winner_price,
          }
        : null,
    }

    job.set('error_message', JSON.stringify(summary))
    app.save(job)
  },
  (app) => {},
)
