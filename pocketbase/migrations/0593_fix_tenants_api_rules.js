/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('tenants')
      if (col) {
        // Permite list/view para qualquer usuário autenticado (ou especificamente pelo tenant/mestre)
        col.listRule = "@request.auth.id != ''"
        col.viewRule = "@request.auth.id != ''"
        app.save(col)
        console.log(
          '[0593] Regras de list/view da coleção tenants atualizadas para @request.auth.id != ""',
        )
      }

      // Garantir também tenant_id preenchido nos usuários
      try {
        const usersCol = app.findCollectionByNameOrId('users')
        if (usersCol) {
          app
            .db()
            .newQuery(
              `UPDATE "users" SET "tenant_id" = 'ambicorpmestre1' WHERE "tenant_id" IS NULL OR "tenant_id" = ''`,
            )
            .execute()
          console.log('[0593] Usuários sem tenant_id atualizados para ambicorpmestre1')
        }
      } catch (userErr) {
        console.log('[0593] Aviso ao atualizar tenant_id dos usuários: ' + userErr)
      }
    } catch (err) {
      console.log('[0593] Erro ao atualizar regras de tenants: ' + err)
    }
  },
  (app) => {},
)
