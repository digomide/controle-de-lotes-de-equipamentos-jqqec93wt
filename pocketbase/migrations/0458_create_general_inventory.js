/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const AUTH_ALL = "@request.auth.id != ''"
    const ADMIN_ONLY = "@request.auth.id != '' && @request.auth.role = 'admin'"

    // 1. Coleção general_inventory_items (itens de estoque geral independentes de lotes/notebooks)
    if (!app.hasTable('general_inventory_items')) {
      const itemsCollection = new Collection({
        name: 'general_inventory_items',
        type: 'base',
        listRule: AUTH_ALL,
        viewRule: AUTH_ALL,
        createRule: AUTH_ALL,
        updateRule: AUTH_ALL,
        deleteRule: ADMIN_ONLY,
        fields: [
          {
            name: 'description',
            type: 'text',
            required: true,
          },
          {
            name: 'category',
            type: 'text',
            required: true,
          },
          {
            name: 'quantity',
            type: 'number',
            min: 0,
          },
          {
            name: 'cost_price',
            type: 'number',
            min: 0,
          },
          {
            name: 'suggested_price',
            type: 'number',
            min: 0,
          },
          {
            name: 'min_stock',
            type: 'number',
            min: 0,
          },
          {
            name: 'location',
            type: 'text',
          },
          {
            name: 'notes',
            type: 'text',
          },
        ],
        indexes: [
          'CREATE INDEX idx_gen_inv_category ON general_inventory_items (category)',
          'CREATE INDEX idx_gen_inv_description ON general_inventory_items (description)',
        ],
      })

      app.save(itemsCollection)
      console.log('[0458] Colecao general_inventory_items criada com sucesso')
    }

    // 2. Coleção general_inventory_movements (histórico auditável de movimentações)
    if (!app.hasTable('general_inventory_movements')) {
      const itemsColRecord = app.findCollectionByNameOrId('general_inventory_items')
      const usersColRecord = app.findCollectionByNameOrId('users')

      const movementsCollection = new Collection({
        name: 'general_inventory_movements',
        type: 'base',
        listRule: AUTH_ALL,
        viewRule: AUTH_ALL,
        createRule: AUTH_ALL,
        updateRule: ADMIN_ONLY,
        deleteRule: ADMIN_ONLY,
        fields: [
          {
            name: 'item_id',
            type: 'relation',
            required: true,
            collectionId: itemsColRecord.id,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'type',
            type: 'select',
            required: true,
            values: ['entrada', 'saida', 'ajuste'],
            maxSelect: 1,
          },
          {
            name: 'quantity',
            type: 'number',
            required: true,
          },
          {
            name: 'quantity_before',
            type: 'number',
          },
          {
            name: 'quantity_after',
            type: 'number',
          },
          {
            name: 'unit_cost',
            type: 'number',
            min: 0,
          },
          {
            name: 'reason',
            type: 'text',
          },
          {
            name: 'observation',
            type: 'text',
          },
          {
            name: 'user_id',
            type: 'relation',
            collectionId: usersColRecord.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
        ],
        indexes: [
          'CREATE INDEX idx_gen_inv_mov_item ON general_inventory_movements (item_id)',
          'CREATE INDEX idx_gen_inv_mov_type ON general_inventory_movements (type)',
        ],
      })

      app.save(movementsCollection)
      console.log('[0458] Colecao general_inventory_movements criada com sucesso')
    }
  },
  (app) => {
    try {
      const movCol = app.findCollectionByNameOrId('general_inventory_movements')
      if (movCol) app.delete(movCol)
    } catch (_) {}

    try {
      const itemsCol = app.findCollectionByNameOrId('general_inventory_items')
      if (itemsCol) app.delete(itemsCol)
    } catch (_) {}
  },
)
