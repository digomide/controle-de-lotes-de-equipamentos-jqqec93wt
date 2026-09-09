migrate(
  (app) => {
    if (!app.hasTable('ml_seller_cache')) {
      const collection = new Collection({
        name: 'ml_seller_cache',
        type: 'base',
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.id != ""',
        deleteRule: '@request.auth.id != ""',
        fields: [
          {
            name: 'seller_id',
            type: 'text',
            required: true,
          },
          {
            name: 'nickname',
            type: 'text',
            required: true,
          },
          {
            name: 'permalink',
            type: 'text',
          },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_ml_seller_cache_seller ON ml_seller_cache (seller_id)',
          'CREATE INDEX idx_ml_seller_cache_nick ON ml_seller_cache (nickname)',
        ],
      })
      app.save(collection)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('ml_seller_cache')
      if (col) {
        app.delete(col)
      }
    } catch (_) {}
  },
)
