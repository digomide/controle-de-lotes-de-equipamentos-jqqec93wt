/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const ALL_CANONICAL_MODULES = [
      'dashboard',
      'vendas',
      'produtos',
      'estoque_lotes',
      'estoque_geral',
      'lotes_compra',
      'ajustes',
      'gestor_ml',
      'explorador_catalogo',
      'radar_ml',
      'lucratividade',
      'marketing',
      'post_instagram',
      'post_tiktok',
      'cotacoes',
      'clientes',
      'notas_fiscais',
      'usuarios',
      'configuracoes',
      'loja',
    ]

    // 1. Criar coleção 'tenants' se não existir
    if (!app.hasTable('tenants')) {
      const tenantsCollection = new Collection({
        name: 'tenants',
        type: 'base',
        // super_admin pode tudo; usuários autenticados podem ver o próprio tenant
        listRule:
          "@request.auth.id != '' && (@request.auth.role = 'super_admin' || @request.auth.tenant_id = id || id = 'ambicorpmestre1')",
        viewRule:
          "@request.auth.id != '' && (@request.auth.role = 'super_admin' || @request.auth.tenant_id = id || id = 'ambicorpmestre1')",
        createRule: "@request.auth.id != '' && @request.auth.role = 'super_admin'",
        updateRule: "@request.auth.id != '' && @request.auth.role = 'super_admin'",
        deleteRule:
          "@request.auth.id != '' && @request.auth.role = 'super_admin' && id != 'ambicorpmestre1'",
        fields: [
          {
            name: 'name',
            type: 'text',
            required: true,
          },
          {
            name: 'slug',
            type: 'text',
            required: true,
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['ativo', 'inativo', 'suspenso'],
            maxSelect: 1,
          },
          {
            name: 'plan',
            type: 'text',
          },
          {
            name: 'commercial_notes',
            type: 'text',
          },
          {
            name: 'modules',
            type: 'json',
            required: true,
          },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_tenants_slug ON tenants (slug)'],
      })
      app.save(tenantsCollection)
      console.log('[0503] Coleção tenants criada com sucesso.')
    }

    // 2. Criar ou garantir Tenant Mestre "Ambicorp" (slug: "ambicorp")
    const tenantsCol = app.findCollectionByNameOrId('tenants')
    let masterTenant = null
    try {
      masterTenant = app.findFirstRecordByFilter('tenants', "slug = 'ambicorp'")
    } catch (_) {}

    if (!masterTenant) {
      masterTenant = new Record(tenantsCol)
      masterTenant.id = 'ambicorpmestre1'
      masterTenant.set('name', 'Ambicorp Mestre')
      masterTenant.set('slug', 'ambicorp')
      masterTenant.set('status', 'ativo')
      masterTenant.set('plan', 'Enterprise / Dono')
      masterTenant.set(
        'commercial_notes',
        'Conta mestre administradora da Ambicorp (dono da plataforma)',
      )
      masterTenant.set('modules', ALL_CANONICAL_MODULES)
      app.save(masterTenant)
      console.log('[0503] Tenant mestre Ambicorp criado com id ambicorpmestre1.')
    } else {
      masterTenant.set('modules', ALL_CANONICAL_MODULES)
      app.save(masterTenant)
    }

    const masterTenantId = masterTenant.id

    // 3. Atualizar coleção 'users':
    // - expandir select role para: super_admin, admin, member
    // - adicionar relation tenant_id -> tenants
    const usersCol = app.findCollectionByNameOrId('users')
    let usersModified = false

    const roleField = usersCol.fields.getByName('role')
    if (roleField) {
      const curValues = roleField.values || []
      if (!curValues.includes('super_admin')) {
        roleField.values = ['super_admin', 'admin', 'member']
        usersModified = true
      }
    }

    const userTenantField = usersCol.fields.getByName('tenant_id')
    if (!userTenantField) {
      usersCol.fields.add(
        new Field({
          name: 'tenant_id',
          type: 'relation',
          collectionId: tenantsCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
      usersModified = true
    }

    if (usersModified) {
      app.save(usersCol)
      console.log('[0503] Coleção users atualizada com role e tenant_id.')
    }

    // Atualizar usuários existentes:
    // rodrigoifgx@gmail.com e gomide vira super_admin vinculado ao tenant mestre
    // outros viram vinculados ao tenant mestre
    const allUsers = app.findRecordsByFilter('users', '1=1', '', 0, 0)
    for (let u of allUsers) {
      const email = (u.getString('email') || '').toLowerCase()
      const curRole = u.getString('role')
      const isOwner = email === 'rodrigoifgx@gmail.com' || email.includes('gomide')

      if (isOwner) {
        u.set('role', 'super_admin')
      } else if (curRole === 'admin') {
        u.set('role', 'admin')
      } else {
        u.set('role', 'member')
      }
      u.set('tenant_id', masterTenantId)
      app.save(u)
    }
    console.log('[0503] Usuários atualizados com tenant_id do tenant mestre.')

    // 4. Lista de coleções de negócio para adicionar o campo tenant_id e preencher com masterTenantId
    const businessCollections = [
      'products',
      'batches',
      'sales',
      'sale_items',
      'purchase_batches',
      'inventory_adjustments',
      'equipment_parts',
      'equipment_deliverables',
      'general_inventory_items',
      'general_inventory_movements',
      'store_orders',
      'corporate_leads',
      'social_posts',
      'marketing_contacts',
      'marketing_campaigns',
      'marketing_messages',
      'marketing_settings',
      'mercadopago_settings',
      'ml_settings',
      'ml_oauth_requests',
      'ml_publish_queue',
      'ml_item_queue',
      'ml_orders',
      'ml_orders_sync_jobs',
      'ml_customers',
      'ml_questions_config',
      'ml_question_templates',
      'ml_questions_cache',
      'ml_question_corrections',
      'ml_monitored_sellers',
      'ml_competitors',
      'ml_competitor_ads',
      'ml_price_history',
      'ml_competitor_events',
      'ml_competitor_jobs',
      'ml_catalog_search_jobs',
      'ml_catalog_publish_jobs',
      'ml_ad_snapshots',
      'ml_position_overrides',
      'ml_collector_imports',
      'ml_collector_keys',
      'nf_config',
      'nf_invoices',
      'tax_rules',
      'kabum_settings',
    ]

    for (let colName of businessCollections) {
      try {
        if (!app.hasTable(colName)) continue
        const col = app.findCollectionByNameOrId(colName)
        let changed = false

        if (!col.fields.getByName('tenant_id')) {
          col.fields.add(
            new Field({
              name: 'tenant_id',
              type: 'relation',
              collectionId: tenantsCol.id,
              cascadeDelete: false,
              maxSelect: 1,
            }),
          )
          changed = true
        }

        // Atualizar regras de API para isolamento real no backend:
        // Super admin pode tudo (@request.auth.role = 'super_admin')
        // Usuário normal/admin acessa apenas registros onde tenant_id = @request.auth.tenant_id
        // Para coleções públicas como store_orders e corporate_leads, o create continua aberto
        const TENANT_AUTH_RULE =
          "@request.auth.id != '' && (@request.auth.role = 'super_admin' || tenant_id = @request.auth.tenant_id)"
        const TENANT_ADMIN_RULE =
          "@request.auth.id != '' && (@request.auth.role = 'super_admin' || (@request.auth.role = 'admin' && tenant_id = @request.auth.tenant_id))"

        if (colName === 'products') {
          // Público anônimo na vitrine vê apenas produtos disponíveis
          col.listRule = `status = 'Disponível' || (${TENANT_AUTH_RULE})`
          col.viewRule = `status = 'Disponível' || (${TENANT_AUTH_RULE})`
          col.createRule = TENANT_AUTH_RULE
          col.updateRule = TENANT_AUTH_RULE
          col.deleteRule = TENANT_ADMIN_RULE
          changed = true
        } else if (colName === 'corporate_leads' || colName === 'store_orders') {
          // Create público aberto, leitura e edição isoladas por tenant
          col.listRule = TENANT_AUTH_RULE
          col.viewRule = TENANT_AUTH_RULE
          col.createRule = '' // aberto para novos pedidos/leads da loja
          col.updateRule = TENANT_AUTH_RULE
          col.deleteRule = TENANT_ADMIN_RULE
          changed = true
        } else if (
          colName === 'ml_settings' ||
          colName === 'mercadopago_settings' ||
          colName === 'marketing_settings' ||
          colName === 'nf_config' ||
          colName === 'kabum_settings'
        ) {
          // Configurações: apenas admin/super_admin do tenant
          col.listRule = TENANT_ADMIN_RULE
          col.viewRule = TENANT_ADMIN_RULE
          col.createRule = TENANT_ADMIN_RULE
          col.updateRule = TENANT_ADMIN_RULE
          col.deleteRule = TENANT_ADMIN_RULE
          changed = true
        } else {
          // Coleções normais de negócio
          col.listRule = TENANT_AUTH_RULE
          col.viewRule = TENANT_AUTH_RULE
          col.createRule = TENANT_AUTH_RULE
          col.updateRule = TENANT_AUTH_RULE
          col.deleteRule = TENANT_ADMIN_RULE
          changed = true
        }

        if (changed) {
          app.save(col)
        }

        // Backfill SQL seguro: preencher qualquer registro existente com tenant_id do tenant mestre
        try {
          app
            .db()
            .newQuery(
              `UPDATE "${colName}" SET "tenant_id" = {:tid} WHERE "tenant_id" IS NULL OR "tenant_id" = ''`,
            )
            .bind({ tid: masterTenantId })
            .execute()
        } catch (updateSqlErr) {
          console.log(`[0503] Aviso no backfill de ${colName}: ` + updateSqlErr)
        }
      } catch (err) {
        console.log(`[0503] Erro ao processar coleção ${colName}: ` + err)
      }
    }

    console.log('[0503] Migration 0503 multi-tenant concluída com sucesso.')
  },
  (app) => {
    // down migration
  },
)
