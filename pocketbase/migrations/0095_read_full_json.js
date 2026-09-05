migrate(
  (app) => {
    // 0095_read_full_json.js
    const job = app.findFirstRecordByData(
      'ml_competitor_jobs',
      'query',
      'probe_mlb_sources_2010941196',
    )
    // Em PocketBase, result_data é JSON.
    // Vamos transformar em string e salvar em error_message que é text
    const str = JSON.stringify(job.get('result_data'))
    job.set('error_message', str.substring(0, 1500))
    app.save(job)
  },
  (app) => {},
)
