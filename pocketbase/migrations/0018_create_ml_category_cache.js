migrate(
  (app) => {
    const collection = new Collection({
      name: 'ml_category_cache',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != ""',
      deleteRule: '@request.auth.id != ""',
      fields: [
        { name: 'category_id', type: 'text', required: true },
        { name: 'attributes', type: 'json' },
        { name: 'cached_at', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_ml_category_cache_category ON ml_category_cache (category_id)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('ml_category_cache')
      app.delete(col)
    } catch (_) {}
  },
)
