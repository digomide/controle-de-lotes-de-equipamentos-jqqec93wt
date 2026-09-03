migrate(
  (app) => {
    const purchaseBatches = app.findCollectionByNameOrId('purchase_batches')

    if (!purchaseBatches.fields.getByName('location')) {
      purchaseBatches.fields.add(
        new TextField({
          name: 'location',
          required: false,
        }),
      )
    }

    if (!purchaseBatches.fields.getByName('notes')) {
      purchaseBatches.fields.add(
        new TextField({
          name: 'notes',
          required: false,
        }),
      )
    }

    app.save(purchaseBatches)
  },
  (app) => {
    try {
      const purchaseBatches = app.findCollectionByNameOrId('purchase_batches')
      const locationField = purchaseBatches.fields.getByName('location')
      if (locationField) purchaseBatches.fields.remove(locationField)
      const notesField = purchaseBatches.fields.getByName('notes')
      if (notesField) purchaseBatches.fields.remove(notesField)
      app.save(purchaseBatches)
    } catch (_) {}
  },
)
