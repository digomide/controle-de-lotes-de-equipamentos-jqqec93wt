migrate(
  (app) => {
    // 0344_verify_publish_result.js
    const recs = app.findRecordsByFilter(
      'ml_ads_fetch_jobs',
      "status_filter='__PERICIA_0343__'",
      '-created',
      1,
      0,
    )
    if (recs && recs.length > 0) {
      console.log('PERICIA_0343_RESULT: ' + recs[0].getString('progress_text'))
      console.log('PERICIA_0343_DATA: ' + recs[0].getString('error_message'))
    }
  },
  (app) => {},
)
