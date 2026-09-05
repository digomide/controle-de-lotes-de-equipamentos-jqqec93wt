migrate(
  (app) => {
    // 1. Coleção ml_competitors
    if (!app.hasTable('ml_competitors')) {
      const col = new Collection({
        name: 'ml_competitors',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          { name: 'seller_id', type: 'text', required: true },
          { name: 'nickname', type: 'text' },
          { name: 'notes', type: 'text' },
          { name: 'active', type: 'bool' },
          { name: 'permalink', type: 'text' },
          { name: 'last_synced_at', type: 'date' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_ml_competitors_seller ON ml_competitors (seller_id)',
          'CREATE INDEX idx_ml_competitors_created ON ml_competitors (created DESC)',
        ],
      })
      app.save(col)
    }

    // 2. Coleção ml_competitor_ads
    if (!app.hasTable('ml_competitor_ads')) {
      const col = new Collection({
        name: 'ml_competitor_ads',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          { name: 'mlb_item_id', type: 'text', required: true },
          { name: 'seller_id', type: 'text', required: true },
          { name: 'seller_nickname', type: 'text' },
          { name: 'title', type: 'text', required: true },
          { name: 'current_price', type: 'number' },
          { name: 'initial_price', type: 'number' },
          { name: 'sold_quantity', type: 'number' },
          { name: 'available_quantity', type: 'number' },
          {
            name: 'status',
            type: 'select',
            values: ['active', 'paused', 'closed', 'under_review'],
            maxSelect: 1,
          },
          { name: 'permalink', type: 'text' },
          { name: 'thumbnail', type: 'text' },
          { name: 'condition', type: 'text' },
          { name: 'brand', type: 'text' },
          { name: 'model', type: 'text' },
          { name: 'gtin', type: 'text' },
          { name: 'last_checked', type: 'date' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_ml_competitor_ads_item ON ml_competitor_ads (mlb_item_id)',
          'CREATE INDEX idx_ml_competitor_ads_seller ON ml_competitor_ads (seller_id)',
          'CREATE INDEX idx_ml_competitor_ads_status ON ml_competitor_ads (status)',
          'CREATE INDEX idx_ml_competitor_ads_last_checked ON ml_competitor_ads (last_checked DESC)',
        ],
      })
      app.save(col)
    }

    // 3. Coleção ml_price_history
    if (!app.hasTable('ml_price_history')) {
      const col = new Collection({
        name: 'ml_price_history',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: null, // Apenas via hooks ou sistema interno
        updateRule: null,
        deleteRule: "@request.auth.id != ''",
        fields: [
          { name: 'mlb_item_id', type: 'text', required: true },
          { name: 'seller_id', type: 'text' },
          { name: 'price', type: 'number', required: true },
          { name: 'sold_quantity', type: 'number' },
          { name: 'available_quantity', type: 'number' },
          { name: 'status', type: 'text' },
          { name: 'checked_at', type: 'date', required: true },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_ml_price_history_item_checked ON ml_price_history (mlb_item_id, checked_at DESC)',
          'CREATE INDEX idx_ml_price_history_seller ON ml_price_history (seller_id)',
        ],
      })
      app.save(col)
    }

    // 4. Coleção ml_competitor_events
    if (!app.hasTable('ml_competitor_events')) {
      const col = new Collection({
        name: 'ml_competitor_events',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: null, // Gravado via hooks
        updateRule: null,
        deleteRule: "@request.auth.id != ''",
        fields: [
          { name: 'mlb_item_id', type: 'text', required: true },
          { name: 'seller_id', type: 'text', required: true },
          { name: 'seller_nickname', type: 'text' },
          { name: 'ad_title', type: 'text' },
          {
            name: 'event_type',
            type: 'select',
            values: [
              'price_change',
              'sold_progress',
              'new_ad',
              'ad_paused',
              'ad_closed',
              'stock_change',
            ],
            maxSelect: 1,
          },
          { name: 'old_value', type: 'text' },
          { name: 'new_value', type: 'text' },
          { name: 'difference_num', type: 'number' },
          { name: 'notes', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_ml_comp_events_item ON ml_competitor_events (mlb_item_id)',
          'CREATE INDEX idx_ml_comp_events_seller ON ml_competitor_events (seller_id)',
          'CREATE INDEX idx_ml_comp_events_type ON ml_competitor_events (event_type)',
          'CREATE INDEX idx_ml_comp_events_created ON ml_competitor_events (created DESC)',
        ],
      })
      app.save(col)
    }

    // 5. Coleção ml_competitor_jobs (Fila de jobs de monitoramento)
    if (!app.hasTable('ml_competitor_jobs')) {
      const col = new Collection({
        name: 'ml_competitor_jobs',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: null,
        deleteRule: "@request.auth.id != ''",
        fields: [
          {
            name: 'action',
            type: 'select',
            values: ['resolve_competitor', 'sync_competitor', 'sync_all', 'search_query'],
            maxSelect: 1,
          },
          { name: 'query', type: 'text' },
          { name: 'seller_id', type: 'text' },
          { name: 'seller_nickname', type: 'text' },
          {
            name: 'status',
            type: 'select',
            values: ['pending', 'processing', 'done', 'error'],
            maxSelect: 1,
          },
          { name: 'status_code', type: 'number' },
          { name: 'error_message', type: 'text' },
          { name: 'result_data', type: 'json' },
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
          'CREATE INDEX idx_ml_comp_jobs_status ON ml_competitor_jobs (status)',
          'CREATE INDEX idx_ml_comp_jobs_created ON ml_competitor_jobs (created DESC)',
        ],
      })
      app.save(col)
    }
  },
  (app) => {
    try {
      const jobs = app.findCollectionByNameOrId('ml_competitor_jobs')
      if (jobs) app.delete(jobs)
    } catch (_) {}
    try {
      const events = app.findCollectionByNameOrId('ml_competitor_events')
      if (events) app.delete(events)
    } catch (_) {}
    try {
      const hist = app.findCollectionByNameOrId('ml_price_history')
      if (hist) app.delete(hist)
    } catch (_) {}
    try {
      const ads = app.findCollectionByNameOrId('ml_competitor_ads')
      if (ads) app.delete(ads)
    } catch (_) {}
    try {
      const comp = app.findCollectionByNameOrId('ml_competitors')
      if (comp) app.delete(comp)
    } catch (_) {}
  },
)
