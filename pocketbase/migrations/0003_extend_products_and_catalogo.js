migrate(
  (app) => {
    const products = app.findCollectionByNameOrId('products')

    // Add cost_price
    if (!products.fields.getByName('cost_price')) {
      products.fields.add(
        new NumberField({
          name: 'cost_price',
          required: false,
        }),
      )
    }

    // Add brand
    if (!products.fields.getByName('brand')) {
      products.fields.add(
        new TextField({
          name: 'brand',
          required: false,
        }),
      )
    }

    // Add model
    if (!products.fields.getByName('model')) {
      products.fields.add(
        new TextField({
          name: 'model',
          required: false,
        }),
      )
    }

    // Add processor
    if (!products.fields.getByName('processor')) {
      products.fields.add(
        new TextField({
          name: 'processor',
          required: false,
        }),
      )
    }

    // Add ram
    if (!products.fields.getByName('ram')) {
      products.fields.add(
        new TextField({
          name: 'ram',
          required: false,
        }),
      )
    }

    // Add storage
    if (!products.fields.getByName('storage')) {
      products.fields.add(
        new TextField({
          name: 'storage',
          required: false,
        }),
      )
    }

    // Add condition (Excelente / Bom)
    if (!products.fields.getByName('condition')) {
      products.fields.add(
        new TextField({
          name: 'condition',
          required: false,
        }),
      )
    }

    // Add aesthetic_grade (ex: 'B - Bom', 'A - Excelente')
    if (!products.fields.getByName('aesthetic_grade')) {
      products.fields.add(
        new TextField({
          name: 'aesthetic_grade',
          required: false,
        }),
      )
    }

    // Add battery_health (ex: '100%')
    if (!products.fields.getByName('battery_health')) {
      products.fields.add(
        new TextField({
          name: 'battery_health',
          required: false,
        }),
      )
    }

    // Add screen_size (ex: '13.3"', '14"', '15.6"')
    if (!products.fields.getByName('screen_size')) {
      products.fields.add(
        new TextField({
          name: 'screen_size',
          required: false,
        }),
      )
    }

    // Add status (Disponível, Reservado, Vendido)
    if (!products.fields.getByName('status')) {
      products.fields.add(
        new SelectField({
          name: 'status',
          values: ['Disponível', 'Reservado', 'Vendido'],
          maxSelect: 1,
          required: false,
        }),
      )
    }

    // Add images (JSON array of URLs)
    if (!products.fields.getByName('images')) {
      products.fields.add(
        new JSONField({
          name: 'images',
          maxSize: 2000000,
        }),
      )
    }

    // Add technical_checklist (JSON array of checklist items)
    if (!products.fields.getByName('technical_checklist')) {
      products.fields.add(
        new JSONField({
          name: 'technical_checklist',
          maxSize: 2000000,
        }),
      )
    }

    // Add history_events (JSON array of events)
    if (!products.fields.getByName('history_events')) {
      products.fields.add(
        new JSONField({
          name: 'history_events',
          maxSize: 2000000,
        }),
      )
    }

    // Add code (ex: EQ-2026-DC218)
    if (!products.fields.getByName('code')) {
      products.fields.add(
        new TextField({
          name: 'code',
          required: false,
        }),
      )
    }

    app.save(products)

    // Create equipment_parts collection
    try {
      app.findCollectionByNameOrId('equipment_parts')
    } catch (_) {
      const partsCol = new Collection({
        name: 'equipment_parts',
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
            collectionId: products.id,
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'name', type: 'text', required: true },
          { name: 'cost', type: 'number', required: false },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['Pendente', 'Trocado', 'Instalado', 'Danificado'],
            maxSelect: 1,
          },
          { name: 'notes', type: 'text', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
      })
      app.save(partsCol)
    }

    // Create equipment_deliverables (Pendências de Entrega) collection
    try {
      app.findCollectionByNameOrId('equipment_deliverables')
    } catch (_) {
      const delivCol = new Collection({
        name: 'equipment_deliverables',
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
            collectionId: products.id,
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'item_name', type: 'text', required: true },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['Pendente', 'Resolvido'],
            maxSelect: 1,
          },
          { name: 'notes', type: 'text', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
      })
      app.save(delivCol)
    }
  },
  (app) => {
    // Revert logic
    try {
      const partsCol = app.findCollectionByNameOrId('equipment_parts')
      app.delete(partsCol)
    } catch (_) {}

    try {
      const delivCol = app.findCollectionByNameOrId('equipment_deliverables')
      app.delete(delivCol)
    } catch (_) {}
  },
)
