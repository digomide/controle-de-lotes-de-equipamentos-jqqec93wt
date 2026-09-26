migrate(
  (app) => {
    // 0511_inspect_summary_text.js
    const jobRecs = app.findRecordsByFilter(
      'ml_competitor_jobs',
      'query = "diag_mlb5195337721"',
      '-created',
      1,
      0,
    )
    if (!jobRecs || jobRecs.length === 0) return
    const j = jobRecs[0]
    const data = j.get('result_data')

    const getBody = data.get?.body || {}
    const putBody = data.put?.body || {}

    const col = app.findCollectionByNameOrId('ml_competitor_jobs')
    const summaryJob = new Record(col)
    summaryJob.set('action', 'search_query')
    summaryJob.set('status', 'done')
    summaryJob.set('query', 'text_mlb5195337721')
    summaryJob.set('error_message', 'PUT=' + JSON.stringify(putBody).substring(0, 500))
    summaryJob.set('result_data', {
      get_keys: Object.keys(getBody),
      put_keys: Object.keys(putBody),
      put_error: putBody.message || putBody.error,
      put_cause: putBody.cause,
      put_status: data.put?.status,
      get_seller: getBody.seller_id,
      get_status: data.get?.status,
    })
    app.save(summaryJob)
  },
  (app) => {},
)
