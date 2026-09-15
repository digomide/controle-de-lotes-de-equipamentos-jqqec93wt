/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const salesCol = app.findCollectionByNameOrId('sales')
    if (!salesCol) return

    let changed = false

    // Campo cancel_reason: text
    try {
      salesCol.fields.getByName('cancel_reason')
    } catch (_) {
      salesCol.fields.add(
        new Field({
          name: 'cancel_reason',
          type: 'text',
          required: false,
        }),
      )
      changed = true
    }

    // Campo cancelled_at: date
    try {
      salesCol.fields.getByName('cancelled_at')
    } catch (_) {
      salesCol.fields.add(
        new Field({
          name: 'cancelled_at',
          type: 'date',
          required: false,
        }),
      )
      changed = true
    }

    // Campo cancelled_by: relation -> users
    try {
      salesCol.fields.getByName('cancelled_by')
    } catch (_) {
      const usersCol = app.findCollectionByNameOrId('users')
      if (usersCol) {
        salesCol.fields.add(
          new Field({
            name: 'cancelled_by',
            type: 'relation',
            required: false,
            collectionId: usersCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          }),
        )
        changed = true
      }
    }

    if (changed) {
      app.save(salesCol)
      console.log(
        '[0502] Campos cancel_reason, cancelled_at e cancelled_by adicionados na coleção sales',
      )
    }
  },
  (app) => {
    try {
      const salesCol = app.findCollectionByNameOrId('sales')
      if (!salesCol) return

      try {
        salesCol.fields.removeByName('cancel_reason')
      } catch (_) {}
      try {
        salesCol.fields.removeByName('cancelled_at')
      } catch (_) {}
      try {
        salesCol.fields.removeByName('cancelled_by')
      } catch (_) {}

      app.save(salesCol)
    } catch (_) {}
  },
)
