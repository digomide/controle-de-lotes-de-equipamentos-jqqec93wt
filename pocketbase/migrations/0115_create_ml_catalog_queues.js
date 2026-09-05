migrate(
  (app) => {
    // 1. Criar coleção ml_catalog_search_jobs
    const searchJobCol = new Collection({
      name: 'ml_catalog_search_jobs',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        { name: 'query', type: 'text' },
        { name: 'domain_id', type: 'text' },
        {
          name: 'status',
          type: 'select',
          values: ['pending', 'processing', 'done', 'error'],
          maxSelect: 1,
        },
        { name: 'status_code', type: 'number' },
        { name: 'error_message', type: 'text' },
        { name: 'strategy_used', type: 'text' },
        { name: 'results', type: 'json' },
        { name: 'raw_debug', type: 'json' },
        { name: 'requested_by', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_ml_catalog_search_jobs_status ON ml_catalog_search_jobs (status, created DESC)',
      ],
    })
    app.save(searchJobCol)

    // 2. Criar coleção ml_catalog_publish_jobs
    const publishJobCol = new Collection({
      name: 'ml_catalog_publish_jobs',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        { name: 'catalog_product_id', type: 'text', required: true },
        {
          name: 'product_id',
          type: 'relation',
          collectionId: app.findCollectionByNameOrId('products').id,
          maxSelect: 1,
        },
        { name: 'price', type: 'number', required: true },
        { name: 'quantity', type: 'number', required: true },
        { name: 'domain_id', type: 'text' },
        { name: 'condition', type: 'text' },
        {
          name: 'status',
          type: 'select',
          values: ['pending', 'processing', 'done', 'error'],
          maxSelect: 1,
        },
        { name: 'status_code', type: 'number' },
        { name: 'error_message', type: 'text' },
        { name: 'ml_listing_id', type: 'text' },
        { name: 'ml_listing_url', type: 'text' },
        { name: 'result_data', type: 'json' },
        { name: 'requested_by', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_ml_catalog_publish_jobs_status ON ml_catalog_publish_jobs (status, created DESC)',
        'CREATE INDEX idx_ml_catalog_publish_jobs_catalog ON ml_catalog_publish_jobs (catalog_product_id)',
      ],
    })
    app.save(publishJobCol)

    // 3. Adicionar catalog_product_id na coleção products se ainda não existir
    const productsCol = app.findCollectionByNameOrId('products')
    if (!productsCol.fields.getByName('catalog_product_id')) {
      productsCol.fields.add(new TextField({ name: 'catalog_product_id' }))
      app.save(productsCol)
    }
  },
  (app) => {
    try {
      const sJob = app.findCollectionByNameOrId('ml_catalog_search_jobs')
      app.delete(sJob)
    } catch (_) {}
    try {
      const pJob = app.findCollectionByNameOrId('ml_catalog_publish_jobs')
      app.delete(pJob)
    } catch (_) {}
  },
)
