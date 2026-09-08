migrate(
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('ml_collector_keys')
      if (col) {
        // Usuário autenticado pode listar/ver chaves
        col.listRule = "@request.auth.id != ''"
        col.viewRule = "@request.auth.id != ''"
        // Qualquer usuário autenticado pode criar sua própria chave (user_id = auth.id) ou admin cria para qualquer um
        col.createRule =
          "@request.auth.id != '' && (user_id = @request.auth.id || @request.auth.role = 'admin')"
        // Apenas o dono ou admin pode atualizar/deletar a chave
        col.updateRule =
          "@request.auth.id != '' && (user_id = @request.auth.id || @request.auth.role = 'admin')"
        col.deleteRule =
          "@request.auth.id != '' && (user_id = @request.auth.id || @request.auth.role = 'admin')"
        app.save(col)
        console.log('[migration 0432] Regras de ml_collector_keys atualizadas com sucesso.')
      }
    } catch (err) {
      console.log('[migration 0432] Erro ao atualizar regras de ml_collector_keys: ' + err)
      throw err
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('ml_collector_keys')
      if (col) {
        col.createRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
        col.updateRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
        col.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
        app.save(col)
      }
    } catch (_) {}
  },
)
