/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    try {
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19)
      app
        .db()
        .newQuery(
          "UPDATE general_inventory_items SET created = {:now}, updated = {:now} WHERE created IS NULL OR created = ''",
        )
        .bind({ now })
        .execute()
      app
        .db()
        .newQuery(
          "UPDATE general_inventory_movements SET created = {:now}, updated = {:now} WHERE created IS NULL OR created = ''",
        )
        .bind({ now })
        .execute()
      console.log(
        '[migration 0494] Backfill de created e updated concluído para registros existentes',
      )
    } catch (err) {
      console.log('[migration 0494] Erro no backfill de timestamps: ' + err)
    }
  },
  (app) => {
    // down migration
  },
)
