migrate(
  (app) => {
    const rec = app.findFirstRecordByFilter(
      'ml_ads_fetch_jobs',
      "status_filter = '__DIAG_INSPIRON_3576__'",
    )
    const full = rec.getString('error_message')
    const arr = JSON.parse(full)
    const titles = arr.map((x) => x.id + ': ' + x.name).join(' | ')
    rec.set('progress_text', titles.substring(0, 250))
    app.save(rec)
  },
  (app) => {},
)
