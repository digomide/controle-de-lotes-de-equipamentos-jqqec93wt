migrate(
  (app) => {
    // 1. Coleção ml_oauth_requests
    // Armazena solicitações de troca de code por tokens do Mercado Livre
    // Regras: create/list/view apenas autenticado; update/delete null (só via hooks/worker)
    if (!app.hasTable('ml_oauth_requests')) {
      const mlOAuthRequests = new Collection({
        name: 'ml_oauth_requests',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: null,
        deleteRule: null,
        fields: [
          { name: 'code', type: 'text', required: true },
          { name: 'redirect_uri', type: 'text' },
          {
            name: 'status',
            type: 'select',
            values: ['pending', 'done', 'error'],
            maxSelect: 1,
          },
          { name: 'error_message', type: 'text' },
          {
            name: 'requested_by',
            type: 'relation',
            collectionId: '_pb_users_auth_',
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
      })
      app.save(mlOAuthRequests)
    }

    // 2. Coleção ml_publish_queue
    // Fila para publicação de anúncios no Mercado Livre
    const productsCol = app.findCollectionByNameOrId('products')
    const productsId = productsCol.id

    if (!app.hasTable('ml_publish_queue')) {
      const mlPublishQueue = new Collection({
        name: 'ml_publish_queue',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'product',
            type: 'relation',
            collectionId: productsId,
            cascadeDelete: false,
            maxSelect: 1,
            required: true,
          },
          {
            name: 'status',
            type: 'select',
            values: ['pending', 'processing', 'done', 'error'],
            maxSelect: 1,
          },
          { name: 'error_message', type: 'text' },
          { name: 'payload', type: 'json' },
          { name: 'result', type: 'json' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
      })
      app.save(mlPublishQueue)
    }

    // 3. Coleção ml_item_queue
    // Fila para pausar, reativar ou encerrar anúncios
    if (!app.hasTable('ml_item_queue')) {
      const mlItemQueue = new Collection({
        name: 'ml_item_queue',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'product',
            type: 'relation',
            collectionId: productsId,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'action',
            type: 'select',
            values: ['pause', 'activate', 'close'],
            maxSelect: 1,
            required: true,
          },
          {
            name: 'status',
            type: 'select',
            values: ['pending', 'processing', 'done', 'error'],
            maxSelect: 1,
          },
          { name: 'error_message', type: 'text' },
          { name: 'result', type: 'json' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
      })
      app.save(mlItemQueue)
    }
  },
  (app) => {
    try {
      const q3 = app.findCollectionByNameOrId('ml_item_queue')
      if (q3) app.delete(q3)
    } catch (_) {}

    try {
      const q2 = app.findCollectionByNameOrId('ml_publish_queue')
      if (q2) app.delete(q2)
    } catch (_) {}

    try {
      const q1 = app.findCollectionByNameOrId('ml_oauth_requests')
      if (q1) app.delete(q1)
    } catch (_) {}
  },
)
