migrate(
  (app) => {
    // 1. Create purchase_batches collection
    try {
      app.findCollectionByNameOrId('purchase_batches')
    } catch (_) {
      const purchaseBatches = new Collection({
        name: 'purchase_batches',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          { name: 'supplier', type: 'text', required: true },
          { name: 'invoice_number', type: 'text' },
          { name: 'purchase_date', type: 'date' },
          { name: 'total_cost', type: 'number', min: 0 },
          { name: 'expected_quantity', type: 'number', min: 1 },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['em_processamento', 'concluido'],
            maxSelect: 1,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
      })
      app.save(purchaseBatches)
    }

    const purchaseBatches = app.findCollectionByNameOrId('purchase_batches')

    // 2. Update products collection with new fields
    const products = app.findCollectionByNameOrId('products')

    // purchase_batch_id (relation -> purchase_batches)
    if (!products.fields.getByName('purchase_batch_id')) {
      products.fields.add(
        new RelationField({
          name: 'purchase_batch_id',
          collectionId: purchaseBatches.id,
          cascadeDelete: false,
          maxSelect: 1,
          required: false,
        }),
      )
    }

    // serial_number (text)
    if (!products.fields.getByName('serial_number')) {
      products.fields.add(
        new TextField({
          name: 'serial_number',
          required: false,
        }),
      )
    }

    // includes_charger (bool - DO NOT mark required as false means empty in PB)
    if (!products.fields.getByName('includes_charger')) {
      products.fields.add(
        new BoolField({
          name: 'includes_charger',
          required: false,
        }),
      )
    }

    // bench_notes (text)
    if (!products.fields.getByName('bench_notes')) {
      products.fields.add(
        new TextField({
          name: 'bench_notes',
          required: false,
        }),
      )
    }

    // aesthetic_grade (text) - already created in 0003, ensure check
    if (!products.fields.getByName('aesthetic_grade')) {
      products.fields.add(
        new TextField({
          name: 'aesthetic_grade',
          required: false,
        }),
      )
    }

    app.save(products)
  },
  (app) => {
    try {
      const products = app.findCollectionByNameOrId('products')
      const fieldsToRemove = [
        'purchase_batch_id',
        'serial_number',
        'includes_charger',
        'bench_notes',
      ]
      for (const f of fieldsToRemove) {
        const field = products.fields.getByName(f)
        if (field) {
          products.fields.remove(field)
        }
      }
      app.save(products)
    } catch (_) {}

    try {
      const purchaseBatches = app.findCollectionByNameOrId('purchase_batches')
      app.delete(purchaseBatches)
    } catch (_) {}
  },
)
