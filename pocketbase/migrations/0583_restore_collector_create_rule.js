/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // -------------------------------------------------------------------------
    // Migração 0583: Restaurar createRule = '' (público) em ml_collector_imports
    // -------------------------------------------------------------------------
    try {
      const col = app.findCollectionByNameOrId('ml_collector_imports')
      if (col) {
        col.createRule = '' // Aberto para permitir requisições com X-Collector-Key
        col.listRule = "@request.auth.id != ''"
        col.viewRule = "@request.auth.id != ''"
        col.updateRule = "@request.auth.id != ''"
        col.deleteRule =
          "@request.auth.id != '' && (@request.auth.role = 'super_admin' || @request.auth.role = 'admin')"
        app.save(col)
        console.log('[migration 0583] createRule restaurada para "" em ml_collector_imports!')
      }
    } catch (err) {
      console.log('[migration 0583] Erro ao restaurar createRule: ' + err)
      throw err
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('ml_collector_imports')
      if (col) {
        col.createRule = "@request.auth.id != ''"
        app.save(col)
      }
    } catch (_) {}
  },
)
