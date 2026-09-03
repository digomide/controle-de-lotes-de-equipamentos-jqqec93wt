migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    // Add role field to users collection if not present
    try {
      if (!users.fields.getByName('role')) {
        users.fields.add(
          new SelectField({
            name: 'role',
            values: ['admin', 'member'],
            maxSelect: 1,
          }),
        )
        app.save(users)
      }
    } catch (_) {}

    // 1. Seed admin user rodrigoifgx@gmail.com
    let adminUserId = ''
    try {
      const existing = app.findAuthRecordByEmail('_pb_users_auth_', 'rodrigoifgx@gmail.com')
      adminUserId = existing.id
      existing.set('role', 'admin')
      existing.set('name', 'Rodrigo Admin')
      app.save(existing)
    } catch (_) {
      const admin = new Record(users)
      admin.setEmail('rodrigoifgx@gmail.com')
      admin.setPassword('Skip@Pass')
      admin.setVerified(true)
      admin.set('name', 'Rodrigo Admin')
      admin.set('role', 'admin')
      app.save(admin)
      adminUserId = admin.id
    }

    // Also create a sales member for testing roles
    try {
      app.findAuthRecordByEmail('_pb_users_auth_', 'vendedor@skip.internal')
    } catch (_) {
      const member = new Record(users)
      member.setEmail('vendedor@skip.internal')
      member.setPassword('Skip@Pass')
      member.setVerified(true)
      member.set('name', 'Carlos Vendedor')
      member.set('role', 'member')
      app.save(member)
    }

    // 2. Seed Products
    const productsCol = app.findCollectionByNameOrId('products')
    const batchesCol = app.findCollectionByNameOrId('batches')

    const sampleProducts = [
      {
        sku: 'EQP-MULT-001',
        name: 'Multímetro Digital True RMS',
        description:
          'Multímetro digital de alta precisão 6000 contagens com medição de temperatura e corrente AC/DC.',
        category: 'Instrumentação & Medição',
        unit_price: 349.9,
        batches: [
          {
            batch_number: 'LOTE-2023-001',
            quantity: 28,
            location: 'Prateleira A-1',
            mfg: '2023-03-10 00:00:00.000Z',
            exp: '2027-03-10 00:00:00.000Z',
          },
          {
            batch_number: 'LOTE-2023-002',
            quantity: 14,
            location: 'Prateleira A-2',
            mfg: '2023-08-15 00:00:00.000Z',
            exp: '2027-08-15 00:00:00.000Z',
          },
          {
            batch_number: 'LOTE-2024-001',
            quantity: 6,
            location: 'Prateleira A-3',
            mfg: '2024-01-20 00:00:00.000Z',
            exp: '2028-01-20 00:00:00.000Z',
          },
        ],
      },
      {
        sku: 'EQP-OSC-100',
        name: 'Osciloscópio 100MHz 2 Canais',
        description:
          'Osciloscópio digital de bancada 100MHz, taxa de amostragem 1GSa/s, tela colorida TFT de 7 polegadas.',
        category: 'Bancada & Laboratório',
        unit_price: 2890.0,
        batches: [
          {
            batch_number: 'LOTE-2023-003',
            quantity: 8,
            location: 'Armário B-1',
            mfg: '2023-05-12 00:00:00.000Z',
            exp: '2028-05-12 00:00:00.000Z',
          },
          {
            batch_number: 'LOTE-2024-002',
            quantity: 4,
            location: 'Armário B-2',
            mfg: '2024-02-18 00:00:00.000Z',
            exp: '2029-02-18 00:00:00.000Z',
          },
        ],
      },
      {
        sku: 'EQP-FONTE-305',
        name: 'Fonte de Bancada DC 30V 5A',
        description:
          'Fonte linear regulável de precisão 0-30V / 0-5A com display quádruplo e proteção contra sobrecarga.',
        category: 'Fontes & Alimentação',
        unit_price: 780.0,
        batches: [
          {
            batch_number: 'LOTE-2023-004',
            quantity: 19,
            location: 'Prateleira C-1',
            mfg: '2023-06-25 00:00:00.000Z',
            exp: '2028-06-25 00:00:00.000Z',
          },
          {
            batch_number: 'LOTE-2024-003',
            quantity: 2,
            location: 'Prateleira C-2',
            mfg: '2024-03-01 00:00:00.000Z',
            exp: '2029-03-01 00:00:00.000Z',
          },
        ],
      },
      {
        sku: 'EQP-SOLD-T12',
        name: 'Estação de Solda Inteligente 75W',
        description:
          'Estação de solda com aquecimento ultrarrápido (8 segundos), controle PID de temperatura e ponta integrada.',
        category: 'Soldagem & Retrabalho',
        unit_price: 450.0,
        batches: [
          {
            batch_number: 'LOTE-2023-005',
            quantity: 22,
            location: 'Prateleira D-1',
            mfg: '2023-09-10 00:00:00.000Z',
            exp: '2027-09-10 00:00:00.000Z',
          },
        ],
      },
      {
        sku: 'EQP-GEN-25M',
        name: 'Gerador de Funções DDS 25MHz',
        description:
          'Gerador de sinais arbitrários de canal duplo com modulação AM/FM/PM e contador de frequência integrado.',
        category: 'Instrumentação & Medição',
        unit_price: 1650.0,
        batches: [
          {
            batch_number: 'LOTE-2023-006',
            quantity: 7,
            location: 'Armário B-3',
            mfg: '2023-07-05 00:00:00.000Z',
            exp: '2028-07-05 00:00:00.000Z',
          },
        ],
      },
    ]

    for (const item of sampleProducts) {
      let prodRecord
      try {
        prodRecord = app.findFirstRecordByData('products', 'sku', item.sku)
      } catch (_) {
        prodRecord = new Record(productsCol)
        prodRecord.set('name', item.name)
        prodRecord.set('sku', item.sku)
        prodRecord.set('description', item.description)
        prodRecord.set('category', item.category)
        prodRecord.set('unit_price', item.unit_price)
        app.save(prodRecord)
      }

      for (const b of item.batches) {
        try {
          app.findFirstRecordByData('batches', 'batch_number', b.batch_number)
        } catch (_) {
          const batchRecord = new Record(batchesCol)
          batchRecord.set('product_id', prodRecord.id)
          batchRecord.set('batch_number', b.batch_number)
          batchRecord.set('quantity', b.quantity)
          batchRecord.set('location', b.location)
          batchRecord.set('manufacturing_date', b.mfg)
          batchRecord.set('expiry_date', b.exp)
          app.save(batchRecord)
        }
      }
    }

    // 3. Seed some initial sales for dashboard metrics
    const salesCol = app.findCollectionByNameOrId('sales')
    const saleItemsCol = app.findCollectionByNameOrId('sale_items')

    try {
      const existingSales = app.findRecordsByFilter(
        'sales',
        "customer_name != ''",
        '-created',
        1,
        0,
      )
      if (existingSales.length === 0) {
        // Find a batch
        const multimeterBatch = app.findFirstRecordByData(
          'batches',
          'batch_number',
          'LOTE-2023-001',
        )
        const oscBatch = app.findFirstRecordByData('batches', 'batch_number', 'LOTE-2023-003')

        // Sale 1: Completed
        const sale1 = new Record(salesCol)
        sale1.set('user_id', adminUserId)
        sale1.set('customer_name', 'TechLab Soluções Eletrônicas')
        sale1.set('customer_contact', 'contato@techlab.com.br - (11) 98765-4321')
        sale1.set('total_amount', 3239.9)
        sale1.set('status', 'completed')
        sale1.set('notes', 'Entrega técnica com certificado de calibração.')
        app.save(sale1)

        const item1a = new Record(saleItemsCol)
        item1a.set('sale_id', sale1.id)
        item1a.set('product_id', multimeterBatch.getString('product_id'))
        item1a.set('batch_id', multimeterBatch.id)
        item1a.set('quantity', 1)
        item1a.set('unit_price', 349.9)
        item1a.set('subtotal', 349.9)
        app.save(item1a)

        const item1b = new Record(saleItemsCol)
        item1b.set('sale_id', sale1.id)
        item1b.set('product_id', oscBatch.getString('product_id'))
        item1b.set('batch_id', oscBatch.id)
        item1b.set('quantity', 1)
        item1b.set('unit_price', 2890.0)
        item1b.set('subtotal', 2890.0)
        app.save(item1b)

        // Sale 2: Completed
        const sale2 = new Record(salesCol)
        sale2.set('user_id', adminUserId)
        sale2.set('customer_name', 'Universidade Politécnica')
        sale2.set('customer_contact', 'compras@poli.edu.br')
        sale2.set('total_amount', 1560.0)
        sale2.set('status', 'completed')
        sale2.set('notes', 'Pedido faturado para 30 dias.')
        app.save(sale2)

        const fonteBatch = app.findFirstRecordByData('batches', 'batch_number', 'LOTE-2023-004')
        const item2 = new Record(saleItemsCol)
        item2.set('sale_id', sale2.id)
        item2.set('product_id', fonteBatch.getString('product_id'))
        item2.set('batch_id', fonteBatch.id)
        item2.set('quantity', 2)
        item2.set('unit_price', 780.0)
        item2.set('subtotal', 1560.0)
        app.save(item2)

        // Sale 3: Draft (Pendente)
        const sale3 = new Record(salesCol)
        sale3.set('user_id', adminUserId)
        sale3.set('customer_name', 'AutoElétrica Silva & Filhos')
        sale3.set('customer_contact', '(19) 99123-5566')
        sale3.set('total_amount', 699.8)
        sale3.set('status', 'draft')
        sale3.set('notes', 'Aguardando confirmação de PIX.')
        app.save(sale3)

        const item3 = new Record(saleItemsCol)
        item3.set('sale_id', sale3.id)
        item3.set('product_id', multimeterBatch.getString('product_id'))
        item3.set('batch_id', multimeterBatch.id)
        item3.set('quantity', 2)
        item3.set('unit_price', 349.9)
        item3.set('subtotal', 699.8)
        app.save(item3)
      }
    } catch (_) {}
  },
  (app) => {
    // down logic is optional/safe cleanup
  },
)
