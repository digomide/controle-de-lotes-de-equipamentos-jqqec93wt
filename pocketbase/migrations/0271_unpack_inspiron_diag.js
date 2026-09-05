migrate(
  (app) => {
    const rec = app.findFirstRecordByFilter(
      'ml_ads_fetch_jobs',
      "status_filter = '__DIAG_INSPIRON_3576__'",
    )
    const full = rec.getString('error_message')
    // Dividir para ver foundAd e apiItem
    const obj = JSON.parse(full)
    rec.set('progress_text', 'foundAd: ' + JSON.stringify(obj.foundAd).substring(0, 200))
    rec.set('error_message', 'apiItem: ' + JSON.stringify(obj.apiItem).substring(0, 500))
    app.save(rec)
  },
  (app) => {},
)
