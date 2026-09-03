migrate(
  (app) => {
    // 1. products collection
    const products = new Collection({
      name: 'products',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'sku', type: 'text', required: true },
        { name: 'description', type: 'text' },
        { name: 'category', type: 'text' },
        { name: 'unit_price', type: 'number', min: 0 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_products_sku ON products (sku)'],
    })
    app.save(products)

    const productsId = app.findCollectionByNameOrId('products').id

    // 2. batches collection
    const batches = new Collection({
      name: 'batches',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'product_id',
          type: 'relation',
          required: true,
          collectionId: productsId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'batch_number', type: 'text', required: true },
        { name: 'quantity', type: 'number', min: 0 },
        { name: 'location', type: 'text' },
        { name: 'expiry_date', type: 'date' },
        { name: 'manufacturing_date', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_batches_product_number ON batches (product_id, batch_number)'],
    })
    app.save(batches)

    const batchesId = app.findCollectionByNameOrId('batches').id

    // 3. sales collection
    const sales = new Collection({
      name: 'sales',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'user_id', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        { name: 'customer_name', type: 'text', required: true },
        { name: 'customer_contact', type: 'text' },
        { name: 'total_amount', type: 'number', min: 0 },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['draft', 'completed', 'cancelled'],
          maxSelect: 1,
        },
        { name: 'notes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(sales)

    const salesId = app.findCollectionByNameOrId('sales').id

    // 4. sale_items collection
    const saleItems = new Collection({
      name: 'sale_items',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'sale_id',
          type: 'relation',
          required: true,
          collectionId: salesId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'product_id',
          type: 'relation',
          required: true,
          collectionId: productsId,
          maxSelect: 1,
        },
        {
          name: 'batch_id',
          type: 'relation',
          required: true,
          collectionId: batchesId,
          maxSelect: 1,
        },
        { name: 'quantity', type: 'number', required: true, min: 1 },
        { name: 'unit_price', type: 'number', min: 0 },
        { name: 'subtotal', type: 'number', min: 0 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(saleItems)

    // 5. inventory_adjustments collection
    const inventoryAdjustments = new Collection({
      name: 'inventory_adjustments',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'batch_id',
          type: 'relation',
          required: true,
          collectionId: batchesId,
          maxSelect: 1,
        },
        { name: 'user_id', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        {
          name: 'type',
          type: 'select',
          required: true,
          values: ['count_adjustment', 'manual_entry', 'return'],
          maxSelect: 1,
        },
        { name: 'quantity_before', type: 'number' },
        { name: 'physical_count', type: 'number' },
        { name: 'quantity_change', type: 'number', required: true },
        { name: 'reason', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(inventoryAdjustments)
  },
  (app) => {
    const toDelete = ['inventory_adjustments', 'sale_items', 'sales', 'batches', 'products']
    for (const name of toDelete) {
      try {
        const col = app.findCollectionByNameOrId(name)
        app.delete(col)
      } catch (_) {}
    }
  },
)
