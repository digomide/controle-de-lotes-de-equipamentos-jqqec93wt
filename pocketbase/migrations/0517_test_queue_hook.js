migrate(
  (app) => {
    // 0517_test_queue_hook.js
    let settings = null
    try {
      const sRecords = app.findRecordsByFilter(
        'ml_settings',
        'tenant_id = "ambicorpmestre1"',
        '-created',
        1,
        0,
      )
      if (sRecords && sRecords.length > 0) settings = sRecords[0]
    } catch (_) {}
    if (!settings) return
    const recs = app.findRecordsByFilter(
      'ml_competitor_jobs',
      'query = "inspect_vars_price"',
      '-created',
      1,
      0,
    )
    const errText = recs && recs.length > 0 ? recs[0].getString('error_message') : 'nenhum'

    const col = app.findCollectionByNameOrId('ml_item_queue')
    const q = new Record(col)
    q.set('action', 'update_price')
    q.set('ml_item_id', 'MLB5195337721')
    q.set('new_price', 3500)
    q.set('status', 'error')
    q.set('error_message', 'DEBUG_0515: ' + errText.substring(0, 500))
    app.save(q)
  },
  (app) => {},
)
