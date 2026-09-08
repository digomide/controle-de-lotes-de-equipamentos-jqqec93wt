migrate(
  (app) => {
    // Buscar id do admin para usar como criador quando necessário
    let adminId = ''
    try {
      const admins = app.findRecordsByFilter('users', "role = 'admin'", '', 1, 0)
      if (admins && admins.length > 0) {
        adminId = admins[0].id
      }
    } catch (_) {}

    const ADMIN_ONLY = "@request.auth.id != '' && @request.auth.role = 'admin'"
    const AUTH_ALL = "@request.auth.id != ''"
    const PUBLIC_OPEN = ''

    const collectionsToUpdate = [
      // 1. Credenciais e tokens sensíveis (Apenas admin)
      {
        name: 'ml_settings',
        list: ADMIN_ONLY,
        view: ADMIN_ONLY,
        create: ADMIN_ONLY,
        update: ADMIN_ONLY,
        del: ADMIN_ONLY,
      },
      {
        name: 'mercadopago_settings',
        list: ADMIN_ONLY,
        view: ADMIN_ONLY,
        create: ADMIN_ONLY,
        update: ADMIN_ONLY,
        del: ADMIN_ONLY,
      },
      {
        name: 'marketing_settings',
        list: ADMIN_ONLY,
        view: ADMIN_ONLY,
        create: ADMIN_ONLY,
        update: ADMIN_ONLY,
        del: ADMIN_ONLY,
      },

      // 2. Públicas com create aberto (leads corporativos e pedidos da loja)
      {
        name: 'corporate_leads',
        list: AUTH_ALL,
        view: AUTH_ALL,
        create: PUBLIC_OPEN,
        update: AUTH_ALL,
        del: ADMIN_ONLY,
      },
      {
        name: 'store_orders',
        list: AUTH_ALL,
        view: AUTH_ALL,
        create: PUBLIC_OPEN,
        update: AUTH_ALL,
        del: ADMIN_ONLY,
      },

      // 3. Catálogo de produtos: anônimo vê apenas Disponível
      {
        name: 'products',
        list: "@request.auth.id != '' || status = 'Disponível'",
        view: "@request.auth.id != '' || status = 'Disponível'",
        create: AUTH_ALL,
        update: AUTH_ALL,
        del: ADMIN_ONLY,
      },

      // 4. Ingestor do coletor (create aberto interceptado pelo hook com X-Collector-Key; leitura restrita)
      {
        name: 'ml_collector_imports',
        list: AUTH_ALL,
        view: AUTH_ALL,
        create: PUBLIC_OPEN,
        update: ADMIN_ONLY,
        del: ADMIN_ONLY,
      },
      {
        name: 'ml_collector_keys',
        list: AUTH_ALL,
        view: AUTH_ALL,
        create: ADMIN_ONLY,
        update: ADMIN_ONLY,
        del: ADMIN_ONLY,
      },

      // 5. Operação interna (vendas, lotes, estoque, peças)
      {
        name: 'sales',
        list: AUTH_ALL,
        view: AUTH_ALL,
        create: AUTH_ALL,
        update: AUTH_ALL,
        del: ADMIN_ONLY,
      },
      {
        name: 'sale_items',
        list: AUTH_ALL,
        view: AUTH_ALL,
        create: AUTH_ALL,
        update: AUTH_ALL,
        del: ADMIN_ONLY,
      },
      {
        name: 'batches',
        list: AUTH_ALL,
        view: AUTH_ALL,
        create: AUTH_ALL,
        update: AUTH_ALL,
        del: ADMIN_ONLY,
      },
      {
        name: 'purchase_batches',
        list: AUTH_ALL,
        view: AUTH_ALL,
        create: AUTH_ALL,
        update: AUTH_ALL,
        del: ADMIN_ONLY,
      },
      {
        name: 'equipment_parts',
        list: AUTH_ALL,
        view: AUTH_ALL,
        create: AUTH_ALL,
        update: AUTH_ALL,
        del: ADMIN_ONLY,
      },
      {
        name: 'equipment_deliverables',
        list: AUTH_ALL,
        view: AUTH_ALL,
        create: AUTH_ALL,
        update: AUTH_ALL,
        del: ADMIN_ONLY,
      },
      {
        name: 'inventory_adjustments',
        list: AUTH_ALL,
        view: AUTH_ALL,
        create: AUTH_ALL,
        update: ADMIN_ONLY,
        del: ADMIN_ONLY,
      },

      // 6. Marketing e redes sociais
      {
        name: 'social_posts',
        list: AUTH_ALL,
        view: AUTH_ALL,
        create: AUTH_ALL,
        update: AUTH_ALL,
        del: ADMIN_ONLY,
      },
      {
        name: 'marketing_contacts',
        list: AUTH_ALL,
        view: AUTH_ALL,
        create: AUTH_ALL,
        update: AUTH_ALL,
        del: ADMIN_ONLY,
      },
      {
        name: 'marketing_campaigns',
        list: AUTH_ALL,
        view: AUTH_ALL,
        create: AUTH_ALL,
        update: AUTH_ALL,
        del: ADMIN_ONLY,
      },
      {
        name: 'marketing_messages',
        list: AUTH_ALL,
        view: AUTH_ALL,
        create: AUTH_ALL,
        update: AUTH_ALL,
        del: ADMIN_ONLY,
      },

      // 7. Filas e utilitários Mercado Livre
      {
        name: 'ml_oauth_requests',
        list: ADMIN_ONLY,
        view: ADMIN_ONLY,
        create: ADMIN_ONLY,
        update: ADMIN_ONLY,
        del: ADMIN_ONLY,
      },
      {
        name: 'mp_test_jobs',
        list: ADMIN_ONLY,
        view: ADMIN_ONLY,
        create: ADMIN_ONLY,
        update: ADMIN_ONLY,
        del: ADMIN_ONLY,
      },
      {
        name: 'ml_publish_queue',
        list: AUTH_ALL,
        view: AUTH_ALL,
        create: AUTH_ALL,
        update: AUTH_ALL,
        del: ADMIN_ONLY,
      },
      {
        name: 'ml_item_queue',
        list: AUTH_ALL,
        view: AUTH_ALL,
        create: AUTH_ALL,
        update: AUTH_ALL,
        del: ADMIN_ONLY,
      },
      {
        name: 'ml_catalog_search_jobs',
        list: AUTH_ALL,
        view: AUTH_ALL,
        create: AUTH_ALL,
        update: AUTH_ALL,
        del: ADMIN_ONLY,
      },
      {
        name: 'ml_catalog_publish_jobs',
        list: AUTH_ALL,
        view: AUTH_ALL,
        create: AUTH_ALL,
        update: AUTH_ALL,
        del: ADMIN_ONLY,
      },
      {
        name: 'ml_ads_fetch_jobs',
        list: AUTH_ALL,
        view: AUTH_ALL,
        create: AUTH_ALL,
        update: AUTH_ALL,
        del: ADMIN_ONLY,
      },
      {
        name: 'ml_competitor_jobs',
        list: AUTH_ALL,
        view: AUTH_ALL,
        create: AUTH_ALL,
        update: AUTH_ALL,
        del: ADMIN_ONLY,
      },
      {
        name: 'ml_competitors',
        list: AUTH_ALL,
        view: AUTH_ALL,
        create: AUTH_ALL,
        update: AUTH_ALL,
        del: ADMIN_ONLY,
      },
      {
        name: 'ml_competitor_ads',
        list: AUTH_ALL,
        view: AUTH_ALL,
        create: AUTH_ALL,
        update: AUTH_ALL,
        del: ADMIN_ONLY,
      },
      {
        name: 'ml_price_history',
        list: AUTH_ALL,
        view: AUTH_ALL,
        create: AUTH_ALL,
        update: ADMIN_ONLY,
        del: ADMIN_ONLY,
      },
      {
        name: 'ml_competitor_events',
        list: AUTH_ALL,
        view: AUTH_ALL,
        create: AUTH_ALL,
        update: ADMIN_ONLY,
        del: ADMIN_ONLY,
      },
      {
        name: 'ml_category_cache',
        list: AUTH_ALL,
        view: AUTH_ALL,
        create: AUTH_ALL,
        update: AUTH_ALL,
        del: ADMIN_ONLY,
      },
      {
        name: 'ml_ad_snapshots',
        list: AUTH_ALL,
        view: AUTH_ALL,
        create: AUTH_ALL,
        update: AUTH_ALL,
        del: ADMIN_ONLY,
      },
      {
        name: 'ml_position_overrides',
        list: AUTH_ALL,
        view: AUTH_ALL,
        create: AUTH_ALL,
        update: AUTH_ALL,
        del: ADMIN_ONLY,
      },

      // 8. Usuários
      {
        name: 'users',
        list: AUTH_ALL,
        view: AUTH_ALL,
        create: ADMIN_ONLY,
        update: "@request.auth.id = id || @request.auth.role = 'admin'",
        del: ADMIN_ONLY,
      },
    ]

    for (let i = 0; i < collectionsToUpdate.length; i++) {
      const item = collectionsToUpdate[i]
      try {
        const col = app.findCollectionByNameOrId(item.name)
        if (col) {
          col.listRule = item.list
          col.viewRule = item.view
          col.createRule = item.create
          col.updateRule = item.update
          col.deleteRule = item.del
          app.save(col)
          console.log('[migration 0424] Regras aplicadas para ' + item.name)
        }
      } catch (err) {
        console.log('[migration 0424] Erro na coleção ' + item.name + ': ' + err)
      }
    }
  },
  (app) => {
    // down migration
  },
)
