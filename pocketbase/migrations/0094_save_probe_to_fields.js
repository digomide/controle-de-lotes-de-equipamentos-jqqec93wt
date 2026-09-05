migrate(
  (app) => {
    // 0094_save_probe_to_fields.js
    const job = app.findFirstRecordByData(
      'ml_competitor_jobs',
      'query',
      'probe_mlb_sources_2010941196',
    )
    const rd = job.get('result_data')
    // Salvar campos curtos em seller_id e seller_nickname para vermos via db_query
    job.set('seller_id', JSON.stringify(rd.productEndpointAuth || {}).substring(0, 200))
    job.set('seller_nickname', JSON.stringify(rd.realPage || {}).substring(0, 200))
    app.save(job)
  },
  (app) => {},
)
