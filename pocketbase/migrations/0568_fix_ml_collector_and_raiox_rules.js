/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // -------------------------------------------------------------------------
    // Migração 0568: Correção URGENTE das API rules e preenchimento de tenant_id
    // para Coletor de Navegador do ML e ferramentas de busca / Raio-X
    // -------------------------------------------------------------------------
    const masterTenantId = 'ambicorpmestre1'

    // 1. Coleções do fluxo Coletor / Raio-X que devem permitir operação sem travar por tenant:
    // - ml_collector_imports: salvamento da coleta (browser / bookmarklet / userscript / app)
    // - ml_collector_keys: geração de chaves para usuários logados
    // - ml_ad_snapshots: snapshots registrados durante análise do Raio-X
    // - ml_position_overrides: inclusão/exclusão manual de itens no Raio-X
    // - ml_catalog_search_jobs: disparos de busca no catálogo / Raio-X
    // - ml_catalog_publish_jobs: fila de publicação no catálogo

    const collectionsToAdjust = [
      {
        name: 'ml_collector_imports',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule:
          "@request.auth.id != '' && (@request.auth.role = 'super_admin' || @request.auth.role = 'admin')",
      },
      {
        name: 'ml_collector_keys',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule:
          "@request.auth.id != '' && (@request.auth.role = 'super_admin' || @request.auth.role = 'admin')",
      },
      {
        name: 'ml_ad_snapshots',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule:
          "@request.auth.id != '' && (@request.auth.role = 'super_admin' || @request.auth.role = 'admin')",
      },
      {
        name: 'ml_position_overrides',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule:
          "@request.auth.id != '' && (@request.auth.role = 'super_admin' || @request.auth.role = 'admin')",
      },
      {
        name: 'ml_catalog_search_jobs',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule:
          "@request.auth.id != '' && (@request.auth.role = 'super_admin' || @request.auth.role = 'admin')",
      },
      {
        name: 'ml_catalog_publish_jobs',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule:
          "@request.auth.id != '' && (@request.auth.role = 'super_admin' || @request.auth.role = 'admin')",
      },
    ]

    for (let item of collectionsToAdjust) {
      try {
        if (!app.hasTable(item.name)) continue
        const col = app.findCollectionByNameOrId(item.name)
        if (col) {
          col.listRule = item.listRule
          col.viewRule = item.viewRule
          col.createRule = item.createRule
          col.updateRule = item.updateRule
          col.deleteRule = item.deleteRule
          app.save(col)
          console.log(`[migration 0568] Regras de API relaxadas para a coleção ${item.name}`)
        }
      } catch (err) {
        console.log(`[migration 0568] Erro ao atualizar regras de ${item.name}: ` + err)
      }
    }

    // 2. Backfill de tenant_id para registros órfãos que possam ter ficado sem tenant_id
    const collectionsForBackfill = [
      'ml_collector_imports',
      'ml_collector_keys',
      'ml_ad_snapshots',
      'ml_position_overrides',
      'ml_catalog_search_jobs',
      'ml_catalog_publish_jobs',
    ]

    for (let colName of collectionsForBackfill) {
      try {
        if (app.hasTable(colName)) {
          app
            .db()
            .newQuery(
              `UPDATE "${colName}" SET "tenant_id" = {:tid} WHERE "tenant_id" IS NULL OR "tenant_id" = ''`,
            )
            .bind({ tid: masterTenantId })
            .execute()
          console.log(`[migration 0568] Backfill de tenant_id concluído em ${colName}`)
        }
      } catch (bkErr) {
        console.log(`[migration 0568] Aviso no backfill de ${colName}: ` + bkErr)
      }
    }

    console.log('[migration 0568] Migração 0568 aplicada com sucesso.')
  },
  (app) => {
    // down migration: re-restritivo por tenant
    const collectionsToRevert = [
      'ml_collector_imports',
      'ml_collector_keys',
      'ml_ad_snapshots',
      'ml_position_overrides',
      'ml_catalog_search_jobs',
      'ml_catalog_publish_jobs',
    ]
    const TENANT_AUTH_RULE =
      "@request.auth.id != '' && (@request.auth.role = 'super_admin' || tenant_id = @request.auth.tenant_id)"
    const TENANT_ADMIN_RULE =
      "@request.auth.id != '' && (@request.auth.role = 'super_admin' || (@request.auth.role = 'admin' && tenant_id = @request.auth.tenant_id))"

    for (let colName of collectionsToRevert) {
      try {
        if (!app.hasTable(colName)) continue
        const col = app.findCollectionByNameOrId(colName)
        if (col) {
          col.listRule = TENANT_AUTH_RULE
          col.viewRule = TENANT_AUTH_RULE
          col.createRule = TENANT_AUTH_RULE
          col.updateRule = TENANT_AUTH_RULE
          col.deleteRule = TENANT_ADMIN_RULE
          app.save(col)
        }
      } catch (_) {}
    }
  },
)
