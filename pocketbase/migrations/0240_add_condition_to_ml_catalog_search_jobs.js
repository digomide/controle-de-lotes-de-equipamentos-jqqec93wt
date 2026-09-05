migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('ml_catalog_search_jobs')
    if (!col.fields.getByName('condition')) {
      col.fields.add(new TextField({ name: 'condition' }))
      app.save(col)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('ml_catalog_search_jobs')
      const field = col.fields.getByName('condition')
      if (field) {
        col.fields.removeByName('condition')
        app.save(col)
      }
    } catch (_) {}
  },
)
