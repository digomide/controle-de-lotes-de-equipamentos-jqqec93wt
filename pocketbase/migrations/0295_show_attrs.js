migrate(
  (app) => {
    const rec = app.findFirstRecordByFilter(
      'ml_ads_fetch_jobs',
      "status_filter = '__DIAG_INSPIRON_3576__'",
    )
    const full = rec.getString('error_message')
    const obj = JSON.parse(full)
    // Inspiron attrs
    const attrs = obj.itDataAttrs || []
    const attrStr = attrs.map((a) => a.id + '=' + a.val).join(' | ')
    rec.set('progress_text', ('ATTRS: ' + attrStr).substring(0, 250))
    app.save(rec)
  },
  (app) => {},
)
