migrate(
  (app) => {
    const collection = new Collection({
      name: 'ml_position_overrides',
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
          name: 'ml_item_id',
          type: 'text',
          required: true,
        },
        {
          name: 'action',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['include', 'exclude'],
        },
        {
          name: 'title',
          type: 'text',
        },
        {
          name: 'permalink',
          type: 'text',
        },
        {
          name: 'notes',
          type: 'text',
        },
      ],
      indexes: [
        'CREATE INDEX idx_ml_pos_overrides_term_item ON ml_position_overrides (search_term, ml_item_id)',
        'CREATE INDEX idx_ml_pos_overrides_item ON ml_position_overrides (ml_item_id)',
      ],
    })

    app.save(collection)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('ml_position_overrides')
      if (col) {
        app.delete(col)
      }
    } catch (_) {}
  },
)
