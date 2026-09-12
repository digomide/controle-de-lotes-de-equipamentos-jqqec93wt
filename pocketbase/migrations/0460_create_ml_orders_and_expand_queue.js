/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const AUTH_ALL = "@request.auth.id != ''"
    const ADMIN_ONLY = "@request.auth.id != '' && @request.auth.role = 'admin'"

    // 1. Atualizar ml_item_queue para aceitar as ações 'update_price' e 'update_stock' e campos opcionais
    try {
      const itemQueueCol = app.findCollectionByNameOrId('ml_item_queue')
      if (itemQueueCol) {
        // Expandir valores do campo 'action'
        const actionField = itemQueueCol.fields.getByName('action')
        if (actionField) {
          actionField.values = [
            'pause',
            'activate',
            'close',
            'update_price',
            'update_stock',
            'update_price_stock',
          ]
        }

        // Adicionar campos opcionais new_price, new_quantity, ml_item_id se não existirem
        if (!itemQueueCol.fields.getByName('ml_item_id')) {
          itemQueueCol.fields.add(
            new Field({
              name: 'ml_item_id',
              type: 'text',
              required: false,
            }),
          )
        }
        if (!itemQueueCol.fields.getByName('new_price')) {
          itemQueueCol.fields.add(
            new Field({
              name: 'new_price',
              type: 'number',
              required: false,
            }),
          )
        }
        if (!itemQueueCol.fields.getByName('new_quantity')) {
          itemQueueCol.fields.add(
            new Field({
              name: 'new_quantity',
              type: 'number',
              required: false,
            }),
          )
        }

        app.save(itemQueueCol)
        console.log(
          '[0460] Coleção ml_item_queue atualizada com novas ações e campos de preço/estoque',
        )
      }
    } catch (eQueue) {
      console.log('[0460] Aviso ao atualizar ml_item_queue: ' + eQueue)
    }

    // 2. Criar coleção ml_orders para armazenar pedidos reais da conta ML
    if (!app.hasTable('ml_orders')) {
      const ordersCol = new Collection({
        name: 'ml_orders',
        type: 'base',
        listRule: AUTH_ALL,
        viewRule: AUTH_ALL,
        createRule: AUTH_ALL,
        updateRule: AUTH_ALL,
        deleteRule: ADMIN_ONLY,
        fields: [
          { name: 'order_id', type: 'text', required: true }, // ex: "2000008912345678"
          { name: 'date_created', type: 'date', required: true },
          { name: 'date_closed', type: 'date' },
          { name: 'status', type: 'text', required: true }, // paid, cancelled, confirmed, payment_required, etc.
          { name: 'status_detail', type: 'text' },
          { name: 'total_amount', type: 'number', required: true },
          { name: 'currency_id', type: 'text' },
          { name: 'buyer_id', type: 'text' },
          { name: 'buyer_nickname', type: 'text' },
          { name: 'buyer_name', type: 'text' },
          { name: 'buyer_document', type: 'text' },
          { name: 'shipping_id', type: 'text' },
          { name: 'shipping_status', type: 'text' }, // to_be_agreed, pending, ready_to_ship, shipped, delivered, not_delivered, cancelled
          { name: 'shipping_substatus', type: 'text' },
          { name: 'shipping_mode', type: 'text' }, // me2, me1, custom, not_specified
          { name: 'receiver_address', type: 'json' },
          { name: 'items', type: 'json' }, // [{ item_id, title, quantity, unit_price, full_unit_price, currency_id, sku }]
          { name: 'payments', type: 'json' }, // [{ id, payment_method_id, status, transaction_amount, date_approved }]
          { name: 'feedback', type: 'json' },
          { name: 'tags', type: 'json' },
          { name: 'raw_order', type: 'json' },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_ml_orders_order_id ON ml_orders (order_id)',
          'CREATE INDEX idx_ml_orders_date ON ml_orders (date_created)',
          'CREATE INDEX idx_ml_orders_status ON ml_orders (status)',
          'CREATE INDEX idx_ml_orders_shipping ON ml_orders (shipping_status)',
        ],
      })

      app.save(ordersCol)
      console.log('[0460] Coleção ml_orders criada com sucesso')
    }

    // 3. Criar coleção ml_orders_sync_jobs para orquestrar sincronizações de pedidos via hook
    if (!app.hasTable('ml_orders_sync_jobs')) {
      const usersCol = app.findCollectionByNameOrId('users')

      const syncJobsCol = new Collection({
        name: 'ml_orders_sync_jobs',
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
          { name: 'days_back', type: 'number' }, // ex: 30 dias
          { name: 'orders_fetched', type: 'number' },
          { name: 'orders_saved', type: 'number' },
          { name: 'progress_text', type: 'text' },
          { name: 'error_message', type: 'text' },
          {
            name: 'requested_by',
            type: 'relation',
            collectionId: usersCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
        ],
        indexes: ['CREATE INDEX idx_ml_orders_sync_status ON ml_orders_sync_jobs (status)'],
      })

      app.save(syncJobsCol)
      console.log('[0460] Coleção ml_orders_sync_jobs criada com sucesso')
    }
  },
  (app) => {
    try {
      const j = app.findCollectionByNameOrId('ml_orders_sync_jobs')
      if (j) app.delete(j)
    } catch (_) {}

    try {
      const o = app.findCollectionByNameOrId('ml_orders')
      if (o) app.delete(o)
    } catch (_) {}
  },
)
