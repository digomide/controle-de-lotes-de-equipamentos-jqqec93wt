migrate(
  (app) => {
    const checkCol = app.findCollectionByNameOrId('ml_ads_fetch_jobs')
    const testFilters = [
      '__CHECK_RESULT__',
      '__CHECK_ML_DETAILS__',
      '__CHECK_ML_DETAILS_STR__',
      '__CHECK_SEARCH_5420__',
      '__CHECK_EXACT_ITEM__',
      '__CHECK_FULL_OBJ__',
      '__INSPECT_TARGET__',
      '__INSPECT_TARGET_2__',
      '__INSPECT_TARGET_3__',
    ]
    for (let i = 0; i < testFilters.length; i++) {
      const recs = app.findRecordsByFilter(
        'ml_ads_fetch_jobs',
        "status_filter = '" + testFilters[i] + "'",
        '',
        20,
        0,
      )
      for (let j = 0; j < recs.length; j++) {
        try {
          app.delete(recs[j])
        } catch (_) {}
      }
    }
  },
  (app) => {},
)
