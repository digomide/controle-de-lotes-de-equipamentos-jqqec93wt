migrate(
  (app) => {
    const rec = app.findFirstRecordByFilter(
      'ml_ads_fetch_jobs',
      "status_filter = '__DIAG_INSPIRON_3576__'",
    )
    const full = rec.getString('error_message')
    const obj = JSON.parse(full)
    // Logar lat5420 e insp3576
    const s =
      'LAT: ' +
      JSON.stringify(obj.lat5420) +
      ' \nINSP: ' +
      JSON.stringify(obj.inspiron || obj.insp3576)
    rec.set('progress_text', s.substring(0, 250))
    app.save(rec)
  },
  (app) => {},
)
