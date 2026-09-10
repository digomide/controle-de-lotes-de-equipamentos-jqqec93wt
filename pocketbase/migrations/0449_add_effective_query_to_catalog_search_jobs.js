/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('ml_catalog_search_jobs')
    if (!col) return

    let changed = false
    try {
      col.fields.add(
        new TextField({
          name: 'effective_query',
          required: false,
        }),
      )
      changed = true
    } catch (_) {}

    if (changed) {
      app.save(col)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('ml_catalog_search_jobs')
      if (col) {
        col.fields.removeByName('effective_query')
        app.save(col)
      }
    } catch (_) {}
  },
)
