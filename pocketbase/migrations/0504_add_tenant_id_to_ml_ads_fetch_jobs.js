/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const masterTenantId = 'ambicorpmestre1'
    try {
      if (!app.hasTable('ml_ads_fetch_jobs') || !app.hasTable('tenants')) {
        console.log('[0504] Tabelas necessárias não encontradas, pulando.')
        return
      }

      // 1. Desafogar o banco SQLite IMEDIATAMENTE
      // Limpar registros pesados de diagnóstico/fila descartáveis que travam leituras
      try {
        if (app.hasTable('ml_ads_fetch_jobs')) {
          app.db().newQuery('DELETE FROM "ml_ads_fetch_jobs"').execute()
        }
      } catch (e1) {
        console.log('[0504] Aviso ao truncar ml_ads_fetch_jobs: ' + e1)
      }

      try {
        if (app.hasTable('ml_catalog_search_results')) {
          app.db().newQuery('DELETE FROM "ml_catalog_search_results"').execute()
        }
      } catch (e2) {
        console.log('[0504] Aviso ao truncar ml_catalog_search_results: ' + e2)
      }

      try {
        if (app.hasTable('ml_catalog_search_jobs')) {
          app
            .db()
            .newQuery(
              `UPDATE "ml_catalog_search_jobs" SET "results" = '[]', "raw_debug" = '[]' WHERE length("results") > 500 OR length("raw_debug") > 500`,
            )
            .execute()
        }
      } catch (e3) {
        console.log('[0504] Aviso ao enxugar ml_catalog_search_jobs: ' + e3)
      }

      const tenantsCol = app.findCollectionByNameOrId('tenants')
      const col = app.findCollectionByNameOrId('ml_ads_fetch_jobs')

      let hasTenantField = false
      try {
        hasTenantField = Boolean(col.fields.getByName('tenant_id'))
      } catch (_) {
        hasTenantField = false
      }

      if (!hasTenantField) {
        col.fields.add(
          new Field({
            name: 'tenant_id',
            type: 'relation',
            collectionId: tenantsCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          }),
        )
      }

      const TENANT_AUTH_RULE =
        "@request.auth.id != '' && (@request.auth.role = 'super_admin' || tenant_id = @request.auth.tenant_id)"
      const TENANT_ADMIN_RULE =
        "@request.auth.id != '' && (@request.auth.role = 'super_admin' || (@request.auth.role = 'admin' && tenant_id = @request.auth.tenant_id))"

      col.listRule = TENANT_AUTH_RULE
      col.viewRule = TENANT_AUTH_RULE
      col.createRule = TENANT_AUTH_RULE
      col.updateRule = TENANT_AUTH_RULE
      col.deleteRule = TENANT_ADMIN_RULE

      app.save(col)

      try {
        app
          .db()
          .newQuery(
            `UPDATE "ml_ads_fetch_jobs" SET "tenant_id" = {:tid} WHERE "tenant_id" IS NULL OR "tenant_id" = ''`,
          )
          .bind({ tid: masterTenantId })
          .execute()
      } catch (_) {}
    } catch (err) {
      console.log('[0504] Aviso em 0504_add_tenant_id_to_ml_ads_fetch_jobs: ' + err)
    }
  },
  (app) => {},
)
