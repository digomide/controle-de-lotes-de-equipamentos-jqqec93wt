migrate(
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('ml_settings')
      if (col) {
        // Permitir leitura/listagem a qualquer usuário autenticado (@request.auth.id != '')
        // Preserva mutações (create, update, delete) restritas a admin
        col.listRule = "@request.auth.id != ''"
        col.viewRule = "@request.auth.id != ''"
        col.createRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
        col.updateRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
        col.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
        app.save(col)
        console.log(
          '[migration 0501] Regras de ml_settings atualizadas para permitir list/view de usuários autenticados',
        )
      }
    } catch (err) {
      console.log('[migration 0501] Erro ao atualizar regras de ml_settings: ' + err)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('ml_settings')
      if (col) {
        col.listRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
        col.viewRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
        app.save(col)
      }
    } catch (_) {}
  },
)
