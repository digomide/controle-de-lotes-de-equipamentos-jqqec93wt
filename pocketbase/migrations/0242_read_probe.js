migrate(
  (app) => {
    // 0242: Ler dados do relatório gravado na 0241 e dar console.log
    const recs = app.findRecordsByFilter(
      'ml_ads_fetch_jobs',
      "status_filter = '__PROBE_0241__'",
      '-created',
      1,
      0,
    )
    if (recs.length > 0) {
      console.log('PROBE_0241_PROGRESS: ' + recs[0].getString('progress_text'))
      console.log('PROBE_0241_DATA: ' + recs[0].getString('error_message'))
    }
  },
  (app) => {},
)
