migrate(
  (app) => {
    const collection = new Collection({
      name: 'ml_collector_keys',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        {
          name: 'key',
          type: 'text',
          required: true,
        },
        {
          name: 'name',
          type: 'text',
        },
        {
          name: 'user_id',
          type: 'text',
        },
        {
          name: 'active',
          type: 'bool',
        },
        {
          name: 'last_used_at',
          type: 'date',
        },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_ml_collector_key_uniq ON ml_collector_keys (key)',
        'CREATE INDEX idx_ml_collector_key_user ON ml_collector_keys (user_id)',
      ],
    })

    app.save(collection)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('ml_collector_keys')
      if (col) {
        app.delete(col)
      }
    } catch (_) {}
  },
)
