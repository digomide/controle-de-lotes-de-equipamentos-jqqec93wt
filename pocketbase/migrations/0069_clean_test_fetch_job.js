migrate(
  (app) => {
    // 0069: Limpar job de teste temporário
    try {
      const records = app.findRecordsByFilter(
        'ml_ads_fetch_jobs',
        "id = 'al2jmzigpwi4qav'",
        '',
        1,
        0,
      )
      if (records && records.length > 0) {
        app.delete(records[0])
      }
    } catch (_) {}
  },
  (app) => {},
)
