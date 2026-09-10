/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('ml_catalog_search_jobs')
    if (!col) return

    let changed = false
    try {
      col.fields.add(
        new TextField({
          name: 'depth',
          required: false,
        }),
      )
      changed = true
    } catch (_) {}

    try {
      col.fields.add(
        new NumberField({
          name: 'max_pages',
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
        col.fields.removeByName('depth')
        col.fields.removeByName('max_pages')
        app.save(col)
      }
    } catch (_) {}
  },
)
