migrate(
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('ml_oauth_requests')
      if (col) {
        // Permitir que qualquer usuário autenticado crie e consulte solicitações OAuth
        col.listRule = "@request.auth.id != ''"
        col.viewRule = "@request.auth.id != ''"
        col.createRule = "@request.auth.id != ''"
        col.updateRule = "@request.auth.id != ''"
        app.save(col)
        console.log('[migration 0594] ml_oauth_requests API rules ampliadas com sucesso.')
      }
    } catch (err) {
      console.log('[migration 0594] Erro ao atualizar regras de ml_oauth_requests: ' + err)
    }
  },
  (app) => {
    // down
  },
)
