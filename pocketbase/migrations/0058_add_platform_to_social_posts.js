migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('social_posts')
    if (!col.fields.getByName('platform')) {
      col.fields.add(
        new SelectField({
          name: 'platform',
          required: false,
          values: ['instagram', 'tiktok'],
          maxSelect: 1,
        }),
      )
      col.addIndex('idx_social_posts_platform', false, 'platform', '')
      app.save(col)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('social_posts')
      col.removeIndex('idx_social_posts_platform')
      const field = col.fields.getByName('platform')
      if (field) {
        col.fields.removeByName('platform')
      }
      app.save(col)
    } catch (_) {}
  },
)
