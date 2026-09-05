migrate(
  (app) => {
    const productsCol = app.findCollectionByNameOrId('products')
    const batchesCol = app.findCollectionByNameOrId('batches')

    // 2. Coleção store_orders para pedidos da loja pública
    const storeOrders = new Collection({
      name: 'store_orders',
      type: 'base',
      // Visitantes da loja pública podem criar pedido e consultar o pedido pelo seu ID
      // Modificações gerais ficam restritas à equipe autenticada ou hooks do backend
      listRule: "@request.auth.id != ''",
      viewRule: '',
      createRule: '',
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'product_id',
          type: 'relation',
          required: true,
          collectionId: productsCol.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'batch_id',
          type: 'relation',
          required: false,
          collectionId: batchesCol.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'quantity',
          type: 'number',
          required: true,
          min: 1,
          onlyInt: true,
        },
        {
          name: 'unit_price',
          type: 'number',
          required: true,
          min: 0,
        },
        {
          name: 'total_amount',
          type: 'number',
          required: true,
          min: 0,
        },
        {
          name: 'customer_name',
          type: 'text',
          required: true,
        },
        {
          name: 'customer_phone',
          type: 'text',
          required: true,
        },
        {
          name: 'customer_email',
          type: 'email',
          required: false,
        },
        {
          name: 'customer_document',
          type: 'text',
          required: false,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['pendente', 'aprovado', 'recusado', 'cancelado', 'expirado'],
          maxSelect: 1,
        },
        {
          name: 'origin',
          type: 'select',
          required: true,
          values: ['loja', 'whatsapp'],
          maxSelect: 1,
        },
        {
          name: 'mp_preference_id',
          type: 'text',
          required: false,
        },
        {
          name: 'mp_payment_id',
          type: 'text',
          required: false,
        },
        {
          name: 'mp_init_point',
          type: 'text',
          required: false,
        },
        {
          name: 'mp_status_detail',
          type: 'text',
          required: false,
        },
        {
          name: 'payment_method_id',
          type: 'text',
          required: false,
        },
        {
          name: 'stock_decremented',
          type: 'bool',
        },
        {
          name: 'paid_at',
          type: 'date',
          required: false,
        },
        {
          name: 'notes',
          type: 'text',
          required: false,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_store_orders_status ON store_orders (status)',
        'CREATE INDEX idx_store_orders_product ON store_orders (product_id)',
        'CREATE INDEX idx_store_orders_pref ON store_orders (mp_preference_id)',
        'CREATE INDEX idx_store_orders_pay ON store_orders (mp_payment_id)',
        'CREATE INDEX idx_store_orders_created ON store_orders (created DESC)',
      ],
    })
    app.save(storeOrders)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('store_orders')
      app.delete(col)
    } catch (_) {}
  },
)
