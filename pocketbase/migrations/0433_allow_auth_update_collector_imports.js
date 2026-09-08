migrate(
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('ml_collector_imports')
      if (col) {
        // Permitir update para usuários autenticados para que exclusão de itens de uma coleta funcione
        col.updateRule = "@request.auth.id != ''"
        app.save(col)
        console.log(
          '[migration 0433] updateRule de ml_collector_imports liberada para usuários autenticados',
        )
      }
    } catch (err) {
      console.log('[migration 0433] Erro ao atualizar updateRule em ml_collector_imports: ' + err)
      throw err
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('ml_collector_imports')
      if (col) {
        col.updateRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
        app.save(col)
      }
    } catch (_) {}
  },
)
