migrate(
  (app) => {
    // 1. Atualizar ml_collector_keys com created e updated
    try {
      const keysCol = app.findCollectionByNameOrId('ml_collector_keys')
      if (keysCol) {
        let changed = false
        if (!keysCol.fields.getByName('created')) {
          keysCol.fields.add(
            new AutodateField({
              name: 'created',
              onCreate: true,
              onUpdate: false,
            }),
          )
          changed = true
        }
        if (!keysCol.fields.getByName('updated')) {
          keysCol.fields.add(
            new AutodateField({
              name: 'updated',
              onCreate: true,
              onUpdate: true,
            }),
          )
          changed = true
        }
        if (changed) {
          app.save(keysCol)
          console.log('[migration 0420] Campos created e updated adicionados a ml_collector_keys')
        }
      }
    } catch (e1) {
      console.log('[migration 0420] Erro ao adicionar campos autodate a ml_collector_keys: ' + e1)
    }

    // 2. Atualizar ml_collector_imports com created e updated caso não existam
    try {
      const importsCol = app.findCollectionByNameOrId('ml_collector_imports')
      if (importsCol) {
        let changed = false
        if (!importsCol.fields.getByName('created')) {
          importsCol.fields.add(
            new AutodateField({
              name: 'created',
              onCreate: true,
              onUpdate: false,
            }),
          )
          changed = true
        }
        if (!importsCol.fields.getByName('updated')) {
          importsCol.fields.add(
            new AutodateField({
              name: 'updated',
              onCreate: true,
              onUpdate: true,
            }),
          )
          changed = true
        }
        if (changed) {
          app.save(importsCol)
          console.log(
            '[migration 0420] Campos created e updated adicionados a ml_collector_imports',
          )
        }
      }
    } catch (e2) {
      console.log(
        '[migration 0420] Erro ao adicionar campos autodate a ml_collector_imports: ' + e2,
      )
    }
  },
  (app) => {
    // down migration
  },
)
