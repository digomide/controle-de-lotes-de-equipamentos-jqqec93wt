migrate(
  (app) => {
    try {
      const usersCol = app.findCollectionByNameOrId('users')
      if (usersCol) {
        // Verifica se o campo 'active' já existe
        let hasActive = false
        try {
          if (usersCol.fields && typeof usersCol.fields.getByName === 'function') {
            hasActive = !!usersCol.fields.getByName('active')
          }
        } catch (_) {}

        if (!hasActive) {
          usersCol.fields.add(
            new BoolField({
              name: 'active',
              required: false,
            }),
          )
          app.save(usersCol)
          console.log('[migration 0431] Campo active adicionado à coleção users')
        }

        // Garante que os usuários existentes fiquem com active = true
        try {
          const records = app.findRecordsByFilter('users', 'active != true', '', 100, 0)
          for (let i = 0; i < records.length; i++) {
            records[i].set('active', true)
            app.save(records[i])
          }
        } catch (uErr) {
          console.log('[migration 0431] Aviso ao atualizar active dos usuários: ' + uErr)
        }
      }
    } catch (err) {
      console.log('[migration 0431] Erro na migração 0431: ' + err)
      throw err
    }
  },
  (app) => {
    try {
      const usersCol = app.findCollectionByNameOrId('users')
      if (usersCol) {
        try {
          usersCol.fields.removeByName('active')
          app.save(usersCol)
        } catch (_) {}
      }
    } catch (_) {}
  },
)
