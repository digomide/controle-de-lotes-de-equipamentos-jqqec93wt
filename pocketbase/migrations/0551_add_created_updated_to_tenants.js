/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    try {
      const tenantsCol = app.findCollectionByNameOrId('tenants')
      if (!tenantsCol) {
        console.log('[migration 0551] Coleção tenants não encontrada, ignorando')
        return
      }

      // 1. Adicionar campos autodate created e updated se não existirem
      const existingCreated = tenantsCol.fields.getByName('created')
      if (!existingCreated) {
        tenantsCol.fields.add(
          new AutodateField({
            name: 'created',
            onCreate: true,
            onUpdate: false,
          }),
        )
      }

      const existingUpdated = tenantsCol.fields.getByName('updated')
      if (!existingUpdated) {
        tenantsCol.fields.add(
          new AutodateField({
            name: 'updated',
            onCreate: true,
            onUpdate: true,
          }),
        )
      }

      app.save(tenantsCol)
      console.log('[migration 0551] Campos created/updated adicionados à coleção tenants')

      // 2. Backfill retroativo seguro via SQL para garantir valores não nulos
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19)
      try {
        app
          .db()
          .newQuery(
            "UPDATE tenants SET created = {:now}, updated = {:now} WHERE created IS NULL OR created = ''",
          )
          .bind({ now })
          .execute()
        console.log(
          '[migration 0551] Backfill de timestamps executado com sucesso na coleção tenants',
        )
      } catch (backfillErr) {
        console.log('[migration 0551] Aviso no backfill de timestamps em tenants: ' + backfillErr)
      }
    } catch (err) {
      console.log('[migration 0551] Erro ao adicionar timestamps em tenants: ' + err)
      throw err
    }
  },
  (app) => {
    // down migration: preserva integridade sem apagar dados
  },
)
