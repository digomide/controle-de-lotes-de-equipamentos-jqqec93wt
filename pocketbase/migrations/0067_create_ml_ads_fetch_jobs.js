migrate(
  (app) => {
    // Coleção ml_ads_fetch_jobs para consulta assíncrona dos anúncios do vendedor Mercado Livre
    // Elimina a dependência de routerAdd ('GET /api/ml/items'), que não funciona no boot do PocketBase v0.36
    // Segue o mesmo padrão de fila e hook comprovado em ml_oauth_requests, ml_publish_queue e mp_test_jobs
    if (!app.hasTable('ml_ads_fetch_jobs')) {
      const mlAdsFetchJobs = new Collection({
        name: 'ml_ads_fetch_jobs',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: null,
        deleteRule: "@request.auth.id != ''",
        fields: [
          { name: 'limit', type: 'number', min: 1, max: 100 },
          { name: 'offset', type: 'number', min: 0 },
          { name: 'status_filter', type: 'text' },
          {
            name: 'status',
            type: 'select',
            values: ['pending', 'processing', 'done', 'error'],
            maxSelect: 1,
          },
          { name: 'status_code', type: 'number' },
          { name: 'error_message', type: 'text' },
          { name: 'seller_id', type: 'text' },
          { name: 'seller_nickname', type: 'text' },
          { name: 'items_count', type: 'number' },
          { name: 'paging', type: 'json' },
          { name: 'items', type: 'json' },
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
        indexes: [
          'CREATE INDEX idx_ml_ads_fetch_jobs_status ON ml_ads_fetch_jobs (status)',
          'CREATE INDEX idx_ml_ads_fetch_jobs_created ON ml_ads_fetch_jobs (created DESC)',
        ],
      })
      app.save(mlAdsFetchJobs)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('ml_ads_fetch_jobs')
      if (col) app.delete(col)
    } catch (_) {}
  },
)
