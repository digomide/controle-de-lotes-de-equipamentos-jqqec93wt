migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('ml_ads_fetch_jobs')
    if (col && !col.fields.getByName('progress_text')) {
      col.fields.add(
        new TextField({
          name: 'progress_text',
          required: false,
        }),
      )
      app.save(col)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('ml_ads_fetch_jobs')
      if (col && col.fields.getByName('progress_text')) {
        col.fields.removeByName('progress_text')
        app.save(col)
      }
    } catch (_) {}
  },
)
