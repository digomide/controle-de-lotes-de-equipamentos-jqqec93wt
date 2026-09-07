migrate(
  (app) => {
    const collection = new Collection({
      name: 'ml_collector_imports',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        {
          name: 'search_term',
          type: 'text',
          required: true,
        },
        {
          name: 'source_url',
          type: 'text',
        },
        {
          name: 'imported_at',
          type: 'date',
        },
        {
          name: 'payload',
          type: 'json',
        },
        {
          name: 'results_count',
          type: 'number',
        },
        {
          name: 'with_sales_count',
          type: 'number',
        },
        {
          name: 'notes',
          type: 'text',
        },
      ],
      indexes: [
        'CREATE INDEX idx_ml_collector_term ON ml_collector_imports (search_term)',
        'CREATE INDEX idx_ml_collector_imported_at ON ml_collector_imports (imported_at)',
      ],
    })

    app.save(collection)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('ml_collector_imports')
      if (col) {
        app.delete(col)
      }
    } catch (_) {}
  },
)
