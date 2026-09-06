migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('ml_catalog_search_jobs')
    try {
      col.fields.add(new BoolField({ name: 'is_cached', required: false }))
    } catch (_) {}
    try {
      col.fields.add(new TextField({ name: 'cached_at', required: false }))
    } catch (_) {}
    try {
      col.fields.add(new BoolField({ name: 'force_refresh', required: false }))
    } catch (_) {}
    try {
      col.fields.add(new BoolField({ name: 'stop_requested', required: false }))
    } catch (_) {}
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('ml_catalog_search_jobs')
    try {
      col.fields.removeByName('is_cached')
    } catch (_) {}
    try {
      col.fields.removeByName('cached_at')
    } catch (_) {}
    try {
      col.fields.removeByName('force_refresh')
    } catch (_) {}
    try {
      col.fields.removeByName('stop_requested')
    } catch (_) {}
    app.save(col)
  },
)
