/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const addAutodateFields = (collectionName) => {
      try {
        const col = app.findCollectionByNameOrId(collectionName)
        if (!col) return

        let changed = false
        if (!col.fields.getByName('created')) {
          col.fields.add(
            new AutodateField({
              name: 'created',
              onCreate: true,
              onUpdate: false,
            }),
          )
          changed = true
        }
        if (!col.fields.getByName('updated')) {
          col.fields.add(
            new AutodateField({
              name: 'updated',
              onCreate: true,
              onUpdate: true,
            }),
          )
          changed = true
        }
        if (changed) {
          app.save(col)
          console.log(`[migration 0493] Campos created e updated adicionados a ${collectionName}`)
        }
      } catch (err) {
        console.log(
          `[migration 0493] Erro ao adicionar campos autodate a ${collectionName}: ${err}`,
        )
      }
    }

    addAutodateFields('general_inventory_items')
    addAutodateFields('general_inventory_movements')
  },
  (app) => {
    // down migration
  },
)
