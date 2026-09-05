migrate(
  (app) => {
    const job = app.findFirstRecordByData('ml_catalog_search_jobs', 'id', 'szg3o742i7qawmh')
    const msg = JSON.parse(job.getString('error_message') || '{}')

    // Extrair detalhes cruciais
    const d = msg.detail || {}
    const bb = msg.search_product_bb
    const it = msg.itemsEndpoint

    job.set(
      'error_message',
      JSON.stringify({
        detail_keys: Object.keys(d),
        detail_buy_box_winner: d.buy_box_winner,
        detail_settings: d.settings,
        detail_condition: d.condition,
        detail_attrs: (d.attributes || []).map((a) => a.id + '=' + a.value_name),
        search_bb: bb,
        itemsEndpoint: it,
      }),
    )
    app.save(job)
  },
  (app) => {},
)
