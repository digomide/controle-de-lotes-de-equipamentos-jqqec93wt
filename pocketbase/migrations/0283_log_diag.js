migrate(
  (app) => {
    const rec = app.findFirstRecordByFilter(
      'ml_ads_fetch_jobs',
      "status_filter = '__DIAG_INSPIRON_3576__'",
    )
    console.log(
      '[DIAG_TEST_RESULT] ' +
        rec.getString('progress_text') +
        ' ::: ' +
        rec.getString('error_message'),
    )
  },
  (app) => {},
)
