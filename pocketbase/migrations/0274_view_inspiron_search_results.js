migrate(
  (app) => {
    const rec = app.findFirstRecordByFilter(
      'ml_ads_fetch_jobs',
      "status_filter = '__DIAG_INSPIRON_3576__'",
    )
    const full = rec.getString('error_message')
    const obj = JSON.parse(full)
    // gravar no progress_text os searchRes
    let summary = ''
    if (Array.isArray(obj.searchRes)) {
      summary = obj.searchRes.map((r) => r.id + ': ' + r.name).join(' | ')
    }
    rec.set('progress_text', summary.substring(0, 250))
    rec.set('error_message', JSON.stringify(obj.searchRes))
    app.save(rec)
  },
  (app) => {},
)
