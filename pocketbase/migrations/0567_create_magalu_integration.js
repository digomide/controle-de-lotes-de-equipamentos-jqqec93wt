/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const AUTH_ALL = '@request.auth.id != ""'
    const ADMIN_ONLY = '@request.auth.role = "admin" || @request.auth.role = "super_admin"'

    // 1. Coleção magalu_settings (configurações do seller Magalu Marketplace)
    if (!app.hasTable('magalu_settings')) {
      const magaluSettings = new Collection({
        name: 'magalu_settings',
        type: 'base',
        listRule: AUTH_ALL,
        viewRule: AUTH_ALL,
        createRule: AUTH_ALL,
        updateRule: AUTH_ALL,
        deleteRule: ADMIN_ONLY,
        fields: [
          { name: 'client_id', type: 'text', required: false },
          { name: 'client_secret', type: 'text', required: false },
          { name: 'access_token', type: 'text', required: false },
          { name: 'refresh_token', type: 'text', required: false },
          { name: 'token_expires_at', type: 'date', required: false },
          { name: 'scopes', type: 'text', required: false },
          { name: 'redirect_uri', type: 'text', required: false },
          { name: 'seller_id', type: 'text', required: false },
          { name: 'seller_name', type: 'text', required: false },
          { name: 'tenant_id', type: 'text', required: false },
          { name: 'channel_id', type: 'text', required: false }, // default: 9fe0d853-732b-4e4a-a0b0-cff988ed043d (Magalu)
          { name: 'branch_id', type: 'text', required: false }, // CD ou depósito de envio
          {
            name: 'environment',
            type: 'select',
            values: ['production', 'sandbox'],
            required: false,
          },
          { name: 'notes', type: 'text', required: false },
        ],
        indexes: [
          'CREATE INDEX idx_magalu_settings_tenant ON magalu_settings (tenant_id)',
          'CREATE INDEX idx_magalu_settings_seller ON magalu_settings (seller_id)',
        ],
      })
      app.save(magaluSettings)
      console.log('[0567] Coleção magalu_settings criada com sucesso')
    }

    // 2. Coleção magalu_oauth_requests (troca assíncrona de code OAuth por token)
    if (!app.hasTable('magalu_oauth_requests')) {
      const usersCol = app.findCollectionByNameOrId('users')
      const oauthReq = new Collection({
        name: 'magalu_oauth_requests',
        type: 'base',
        listRule: AUTH_ALL,
        viewRule: AUTH_ALL,
        createRule: AUTH_ALL,
        updateRule: AUTH_ALL,
        deleteRule: ADMIN_ONLY,
        fields: [
          { name: 'code', type: 'text', required: true },
          { name: 'redirect_uri', type: 'text', required: false },
          { name: 'tenant_id', type: 'text', required: false },
          {
            name: 'status',
            type: 'select',
            values: ['pending', 'processing', 'done', 'error'],
            maxSelect: 1,
            required: true,
          },
          { name: 'error_message', type: 'text', required: false },
          {
            name: 'requested_by',
            type: 'relation',
            collectionId: usersCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
        ],
        indexes: ['CREATE INDEX idx_magalu_oauth_status ON magalu_oauth_requests (status)'],
      })
      app.save(oauthReq)
      console.log('[0567] Coleção magalu_oauth_requests criada com sucesso')
    }

    // 3. Coleção magalu_ads_fetch_jobs (busca resiliente assíncrona de anúncios e produtos do Magalu)
    if (!app.hasTable('magalu_ads_fetch_jobs')) {
      const usersCol = app.findCollectionByNameOrId('users')
      const fetchJobs = new Collection({
        name: 'magalu_ads_fetch_jobs',
        type: 'base',
        listRule: AUTH_ALL,
        viewRule: AUTH_ALL,
        createRule: AUTH_ALL,
        updateRule: AUTH_ALL,
        deleteRule: ADMIN_ONLY,
        fields: [
          {
            name: 'status',
            type: 'select',
            values: ['pending', 'processing', 'done', 'error'],
            maxSelect: 1,
            required: true,
          },
          { name: 'limit', type: 'number', required: false },
          { name: 'offset', type: 'number', required: false },
          { name: 'status_filter', type: 'text', required: false },
          { name: 'progress_text', type: 'text', required: false },
          { name: 'error_message', type: 'text', required: false },
          { name: 'status_code', type: 'number', required: false },
          { name: 'items', type: 'json', required: false }, // Lista parseada dos SKUs do Magalu
          { name: 'raw_response', type: 'json', required: false },
          { name: 'total_items', type: 'number', required: false },
          { name: 'tenant_id', type: 'text', required: false },
          {
            name: 'requested_by',
            type: 'relation',
            collectionId: usersCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
        ],
        indexes: ['CREATE INDEX idx_magalu_ads_jobs_status ON magalu_ads_fetch_jobs (status)'],
      })
      app.save(fetchJobs)
      console.log('[0567] Coleção magalu_ads_fetch_jobs criada com sucesso')
    }

    // 4. Coleção magalu_item_queue (fila de alteração atômica de preço, estoque e status de ofertas Magalu)
    if (!app.hasTable('magalu_item_queue')) {
      const usersCol = app.findCollectionByNameOrId('users')
      const itemQueue = new Collection({
        name: 'magalu_item_queue',
        type: 'base',
        listRule: AUTH_ALL,
        viewRule: AUTH_ALL,
        createRule: AUTH_ALL,
        updateRule: AUTH_ALL,
        deleteRule: ADMIN_ONLY,
        fields: [
          { name: 'sku', type: 'text', required: true },
          { name: 'product_id', type: 'text', required: false },
          {
            name: 'action',
            type: 'select',
            values: ['update_price', 'update_stock', 'update_price_stock', 'pause', 'activate'],
            maxSelect: 1,
            required: true,
          },
          { name: 'new_price', type: 'number', required: false },
          { name: 'new_list_price', type: 'number', required: false },
          { name: 'new_quantity', type: 'number', required: false },
          {
            name: 'status',
            type: 'select',
            values: ['pending', 'processing', 'done', 'error'],
            maxSelect: 1,
            required: true,
          },
          { name: 'error_message', type: 'text', required: false },
          { name: 'result', type: 'json', required: false },
          { name: 'tenant_id', type: 'text', required: false },
          {
            name: 'requested_by',
            type: 'relation',
            collectionId: usersCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
        ],
        indexes: [
          'CREATE INDEX idx_magalu_item_queue_status ON magalu_item_queue (status)',
          'CREATE INDEX idx_magalu_item_queue_sku ON magalu_item_queue (sku)',
        ],
      })
      app.save(itemQueue)
      console.log('[0567] Coleção magalu_item_queue criada com sucesso')
    }

    // 5. Coleção magalu_orders (armazenamento e auditoria dos pedidos Magalu)
    if (!app.hasTable('magalu_orders')) {
      const magaluOrders = new Collection({
        name: 'magalu_orders',
        type: 'base',
        listRule: AUTH_ALL,
        viewRule: AUTH_ALL,
        createRule: AUTH_ALL,
        updateRule: AUTH_ALL,
        deleteRule: ADMIN_ONLY,
        fields: [
          { name: 'order_id', type: 'text', required: true },
          { name: 'order_code', type: 'text', required: false },
          { name: 'date_created', type: 'date', required: true },
          { name: 'date_updated', type: 'date', required: false },
          { name: 'status', type: 'text', required: true }, // pending, approved, invoiced, shipped, delivered, cancelled
          { name: 'total_amount', type: 'number', required: true },
          { name: 'currency', type: 'text', required: false },
          { name: 'buyer_name', type: 'text', required: false },
          { name: 'buyer_document', type: 'text', required: false },
          { name: 'shipping_status', type: 'text', required: false },
          { name: 'delivery_id', type: 'text', required: false },
          { name: 'tracking_url', type: 'text', required: false },
          { name: 'carrier_name', type: 'text', required: false },
          { name: 'receiver_address', type: 'json', required: false },
          { name: 'items', type: 'json', required: false }, // [{ sku, name, quantity, unit_price, list_price }]
          { name: 'transactions', type: 'json', required: false },
          { name: 'channel_id', type: 'text', required: false },
          { name: 'raw_order', type: 'json', required: false },
          { name: 'tenant_id', type: 'text', required: false },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_magalu_orders_order_id ON magalu_orders (order_id)',
          'CREATE INDEX idx_magalu_orders_date ON magalu_orders (date_created)',
          'CREATE INDEX idx_magalu_orders_status ON magalu_orders (status)',
          'CREATE INDEX idx_magalu_orders_shipping ON magalu_orders (shipping_status)',
        ],
      })
      app.save(magaluOrders)
      console.log('[0567] Coleção magalu_orders criada com sucesso')
    }

    // 6. Coleção magalu_orders_sync_jobs (orquestração de sincronização de pedidos Magalu)
    if (!app.hasTable('magalu_orders_sync_jobs')) {
      const usersCol = app.findCollectionByNameOrId('users')
      const ordersSyncJobs = new Collection({
        name: 'magalu_orders_sync_jobs',
        type: 'base',
        listRule: AUTH_ALL,
        viewRule: AUTH_ALL,
        createRule: AUTH_ALL,
        updateRule: AUTH_ALL,
        deleteRule: ADMIN_ONLY,
        fields: [
          {
            name: 'status',
            type: 'select',
            values: ['pending', 'processing', 'done', 'error'],
            maxSelect: 1,
            required: true,
          },
          { name: 'days_back', type: 'number', required: false },
          { name: 'orders_fetched', type: 'number', required: false },
          { name: 'orders_saved', type: 'number', required: false },
          { name: 'progress_text', type: 'text', required: false },
          { name: 'error_message', type: 'text', required: false },
          { name: 'tenant_id', type: 'text', required: false },
          {
            name: 'requested_by',
            type: 'relation',
            collectionId: usersCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
        ],
        indexes: ['CREATE INDEX idx_magalu_orders_sync_status ON magalu_orders_sync_jobs (status)'],
      })
      app.save(ordersSyncJobs)
      console.log('[0567] Coleção magalu_orders_sync_jobs criada com sucesso')
    }
  },
  (app) => {
    try {
      const s = app.findCollectionByNameOrId('magalu_settings')
      if (s) app.delete(s)
    } catch (_) {}
    try {
      const o = app.findCollectionByNameOrId('magalu_oauth_requests')
      if (o) app.delete(o)
    } catch (_) {}
    try {
      const j = app.findCollectionByNameOrId('magalu_ads_fetch_jobs')
      if (j) app.delete(j)
    } catch (_) {}
    try {
      const q = app.findCollectionByNameOrId('magalu_item_queue')
      if (q) app.delete(q)
    } catch (_) {}
    try {
      const m = app.findCollectionByNameOrId('magalu_orders')
      if (m) app.delete(m)
    } catch (_) {}
    try {
      const sj = app.findCollectionByNameOrId('magalu_orders_sync_jobs')
      if (sj) app.delete(sj)
    } catch (_) {}
  },
)
