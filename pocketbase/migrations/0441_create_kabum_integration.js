/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Coleção kabum_settings (armazena api_key, api_url, environment, shop_id, shop_name, etc.)
    if (!app.hasTable('kabum_settings')) {
      const kabumSettings = new Collection({
        name: 'kabum_settings',
        type: 'base',
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.id != ""',
        deleteRule: '@request.auth.id != ""',
        fields: [
          {
            name: 'api_key',
            type: 'text',
            required: false,
          },
          {
            name: 'api_url',
            type: 'text',
            required: false,
          },
          {
            name: 'environment',
            type: 'select',
            required: false,
            values: ['production', 'homologation'],
          },
          {
            name: 'shop_id',
            type: 'text',
            required: false,
          },
          {
            name: 'shop_name',
            type: 'text',
            required: false,
          },
          {
            name: 'currency',
            type: 'text',
            required: false,
          },
          {
            name: 'last_test_status',
            type: 'select',
            required: false,
            values: ['success', 'error', 'pending'],
          },
          {
            name: 'last_test_message',
            type: 'text',
            required: false,
          },
          {
            name: 'last_tested_at',
            type: 'date',
            required: false,
          },
          {
            name: 'notes',
            type: 'text',
            required: false,
          },
        ],
      })
      app.save(kabumSettings)
      console.log('[0441] Criada colecao kabum_settings com sucesso')
    }

    // 2. Coleção kabum_categories (árvore de categorias Mirakl / Kabum)
    if (!app.hasTable('kabum_categories')) {
      const kabumCategories = new Collection({
        name: 'kabum_categories',
        type: 'base',
        listRule: '',
        viewRule: '',
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.id != ""',
        deleteRule: '@request.auth.id != ""',
        fields: [
          {
            name: 'category_id',
            type: 'text',
            required: true,
          },
          {
            name: 'name',
            type: 'text',
            required: true,
          },
          {
            name: 'parent_id',
            type: 'text',
            required: false,
          },
          {
            name: 'family_id',
            type: 'text',
            required: false,
          },
          {
            name: 'family_name',
            type: 'text',
            required: false,
          },
          {
            name: 'subfamily_id',
            type: 'text',
            required: false,
          },
          {
            name: 'subfamily_name',
            type: 'text',
            required: false,
          },
          {
            name: 'full_path',
            type: 'text',
            required: false,
          },
          {
            name: 'level',
            type: 'number',
            required: false,
          },
          {
            name: 'is_leaf',
            type: 'bool',
            required: false,
          },
        ],
      })
      app.save(kabumCategories)
      console.log('[0441] Criada colecao kabum_categories com sucesso')
    }

    // 3. Coleção kabum_sync_jobs (fila e jobs de sincronização de ofertas/preço/estoque e produtos)
    if (!app.hasTable('kabum_sync_jobs')) {
      const kabumSyncJobs = new Collection({
        name: 'kabum_sync_jobs',
        type: 'base',
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.id != ""',
        deleteRule: '@request.auth.id != ""',
        fields: [
          {
            name: 'job_type',
            type: 'select',
            required: true,
            values: [
              'price_stock_sync',
              'product_publish',
              'order_sync',
              'category_sync',
              'test_connection',
            ],
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['pending', 'processing', 'done', 'error', 'dormant'],
          },
          {
            name: 'product_id',
            type: 'text',
            required: false,
          },
          {
            name: 'payload',
            type: 'json',
            required: false,
          },
          {
            name: 'result',
            type: 'json',
            required: false,
          },
          {
            name: 'error_message',
            type: 'text',
            required: false,
          },
          {
            name: 'mirakl_import_id',
            type: 'text',
            required: false,
          },
          {
            name: 'requested_by',
            type: 'relation',
            required: false,
            collectionId: '_pb_users_auth_',
            maxSelect: 1,
          },
        ],
      })
      app.save(kabumSyncJobs)
      console.log('[0441] Criada colecao kabum_sync_jobs com sucesso')
    }
  },
  (app) => {
    try {
      const s = app.findCollectionByNameOrId('kabum_settings')
      if (s) app.delete(s)
    } catch (_) {}
    try {
      const c = app.findCollectionByNameOrId('kabum_categories')
      if (c) app.delete(c)
    } catch (_) {}
    try {
      const j = app.findCollectionByNameOrId('kabum_sync_jobs')
      if (j) app.delete(j)
    } catch (_) {}
  },
)
