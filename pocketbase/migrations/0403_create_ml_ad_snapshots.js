migrate(
  (app) => {
    // Verificar se collection ml_ad_snapshots já existe
    try {
      app.findCollectionByNameOrId('ml_ad_snapshots')
      return
    } catch (_) {}

    const collection = new Collection({
      name: 'ml_ad_snapshots',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        {
          name: 'item_id',
          type: 'text',
          required: true,
        },
        {
          name: 'catalog_product_id',
          type: 'text',
        },
        {
          name: 'seller_id',
          type: 'text',
        },
        {
          name: 'seller_nickname',
          type: 'text',
        },
        {
          name: 'title',
          type: 'text',
        },
        {
          name: 'price',
          type: 'number',
        },
        {
          name: 'available_quantity',
          type: 'number',
        },
        {
          name: 'sold_quantity',
          type: 'number',
        },
        {
          name: 'listing_type',
          type: 'text',
        },
        {
          name: 'is_buy_box_winner',
          type: 'bool',
        },
        {
          name: 'snapshot_date',
          type: 'date',
          required: true,
        },
        {
          name: 'created',
          type: 'autodate',
          onCreate: true,
          onUpdate: false,
        },
        {
          name: 'updated',
          type: 'autodate',
          onCreate: true,
          onUpdate: true,
        },
      ],
      indexes: [
        'CREATE INDEX idx_ml_ad_snapshots_item ON ml_ad_snapshots (item_id)',
        'CREATE INDEX idx_ml_ad_snapshots_seller ON ml_ad_snapshots (seller_id)',
        'CREATE INDEX idx_ml_ad_snapshots_date ON ml_ad_snapshots (snapshot_date)',
      ],
    })

    app.save(collection)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('ml_ad_snapshots')
      app.delete(col)
    } catch (_) {}
  },
)
