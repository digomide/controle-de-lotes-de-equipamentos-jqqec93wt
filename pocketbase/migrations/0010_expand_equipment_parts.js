migrate(
  (app) => {
    const parts = app.findCollectionByNameOrId('equipment_parts')
    const purchaseBatches = app.findCollectionByNameOrId('purchase_batches')

    // 1. purchase_batch_id (relation -> purchase_batches)
    if (!parts.fields.getByName('purchase_batch_id')) {
      parts.fields.add(
        new RelationField({
          name: 'purchase_batch_id',
          collectionId: purchaseBatches.id,
          cascadeDelete: false,
          maxSelect: 1,
          required: false,
        }),
      )
    }

    // 2. supplier (text, optional)
    if (!parts.fields.getByName('supplier')) {
      parts.fields.add(
        new TextField({
          name: 'supplier',
          required: false,
        }),
      )
    }

    // 3. purchase_date (date, optional)
    if (!parts.fields.getByName('purchase_date')) {
      parts.fields.add(
        new DateField({
          name: 'purchase_date',
          required: false,
        }),
      )
    }

    // 4. make product_id optional if it was required before, so parts can be batch-level or product-level
    const prodField = parts.fields.getByName('product_id')
    if (prodField) {
      prodField.required = false
    }

    app.save(parts)
  },
  (app) => {
    try {
      const parts = app.findCollectionByNameOrId('equipment_parts')
      const fieldsToRemove = ['purchase_batch_id', 'supplier', 'purchase_date']
      for (const f of fieldsToRemove) {
        const field = parts.fields.getByName(f)
        if (field) {
          parts.fields.remove(field)
        }
      }
      app.save(parts)
    } catch (_) {}
  },
)
