/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('ml_settings')
      if (col) {
        col.listRule = "@request.auth.id != ''"
        col.viewRule = "@request.auth.id != ''"
        col.createRule =
          "@request.auth.id != '' && (@request.auth.role = 'super_admin' || @request.auth.role = 'admin')"
        col.updateRule =
          "@request.auth.id != '' && (@request.auth.role = 'super_admin' || @request.auth.role = 'admin')"
        col.deleteRule =
          "@request.auth.id != '' && (@request.auth.role = 'super_admin' || @request.auth.role = 'admin')"
        app.save(col)
        console.log('[0590] Regras de ml_settings atualizadas para acesso autenticado')
      }
    } catch (err) {
      console.log('[0590] Erro ao atualizar ml_settings: ' + err)
    }
  },
  (app) => {},
)
