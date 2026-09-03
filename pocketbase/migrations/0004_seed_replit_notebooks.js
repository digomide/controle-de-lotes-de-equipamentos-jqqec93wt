migrate(
  (app) => {
    const productsCol = app.findCollectionByNameOrId('products')
    const batchesCol = app.findCollectionByNameOrId('batches')
    const partsCol = app.findCollectionByNameOrId('equipment_parts')
    const delivCol = app.findCollectionByNameOrId('equipment_deliverables')

    const standardChecklist = [
      { item: 'Boot / BIOS', status: 'OK', observation: '' },
      { item: 'Tela / Display', status: 'OK', observation: '' },
      { item: 'Teclado', status: 'OK', observation: '' },
      { item: 'Touchpad / Mouse', status: 'OK', observation: '' },
      { item: 'Portas USB / Vídeo', status: 'OK', observation: '' },
      { item: 'Bateria', status: 'OK', observation: 'Excelente' },
      { item: 'Carregador', status: 'OK', observation: '' },
      { item: 'Câmera / Webcam', status: 'OK', observation: '' },
      { item: 'Microfone', status: 'OK', observation: '' },
      { item: 'Alto-falantes', status: 'OK', observation: '' },
      { item: 'Wi-Fi', status: 'OK', observation: '' },
      {
        item: 'Bluetooth',
        status: 'Não testado',
        observation: 'Este item ainda não foi inspecionado.',
      },
      { item: 'Dobradiças', status: 'OK', observation: '' },
      { item: 'Carcaça / Chassi', status: 'Atenção', observation: 'Marcas cronicas de descascado' },
      { item: 'Memória RAM', status: 'OK', observation: '' },
      { item: 'Armazenamento', status: 'OK', observation: '' },
    ]

    const standardChecklistPerfect = [
      { item: 'Boot / BIOS', status: 'OK', observation: '' },
      { item: 'Tela / Display', status: 'OK', observation: '' },
      { item: 'Teclado', status: 'OK', observation: '' },
      { item: 'Touchpad / Mouse', status: 'OK', observation: '' },
      { item: 'Portas USB / Vídeo', status: 'OK', observation: '' },
      { item: 'Bateria', status: 'OK', observation: '100% de capacidade' },
      { item: 'Carregador', status: 'OK', observation: 'Original incluso' },
      { item: 'Câmera / Webcam', status: 'OK', observation: '' },
      { item: 'Microfone', status: 'OK', observation: '' },
      { item: 'Alto-falantes', status: 'OK', observation: '' },
      { item: 'Wi-Fi', status: 'OK', observation: '' },
      { item: 'Bluetooth', status: 'OK', observation: '' },
      { item: 'Dobradiças', status: 'OK', observation: 'Firmes e alinhadas' },
      { item: 'Carcaça / Chassi', status: 'OK', observation: 'Excelente estado' },
      { item: 'Memória RAM', status: 'OK', observation: '' },
      { item: 'Armazenamento', status: 'OK', observation: 'SMART 100% saudável' },
    ]

    const standardHistory = [
      { title: 'Inspeção e testes registrados', date: '2026-09-02 08:16:00' },
      { title: 'Equipamento preparado para anúncio', date: '2026-09-02 08:16:00' },
    ]

    const notebookItems = [
      {
        sku: 'FS0V6K3',
        code: 'EQ-2026-DC218',
        name: 'Notebook Dell Latitude 5320 (Intel Core I7 11ª Geração 16GB SSD 256 Tela 13.3")',
        brand: 'Dell',
        model: 'Latitude 5320',
        category: 'Notebooks',
        condition: 'Bom',
        aesthetic_grade: 'B - Bom',
        battery_health: '100%',
        screen_size: '13.3"',
        processor: 'Core I7 11ª Geração',
        ram: '16GB DDR4',
        storage: 'SSD 256GB',
        unit_price: 3300.0,
        cost_price: 1950.0,
        status: 'Disponível',
        images: [
          'https://ambicorpflow.replit.app/api/storage/objects/uploads/f03371a0-7da9-4c6a-aac7-df5353c1fecf',
          'https://ambicorpflow.replit.app/api/storage/objects/uploads/5990f68d-fd65-403d-a0ab-6461d31f3afa',
          'https://ambicorpflow.replit.app/api/storage/objects/uploads/5da87817-9fc2-4546-8018-e01983223508',
          'https://ambicorpflow.replit.app/api/storage/objects/uploads/b1f671eb-9802-4033-bf62-9fbf1be6def0',
          'https://ambicorpflow.replit.app/api/storage/objects/uploads/f714f259-1d29-46f7-99b2-fdb02f7e3973',
        ],
        checklist: standardChecklist,
        history: standardHistory,
        parts: [
          {
            name: 'Bateria Original Dell 4-cell',
            cost: 180.0,
            status: 'Instalado',
            notes: 'Bateria trocada na revisão',
          },
        ],
        deliverables: [
          {
            item_name: 'Carregador USB-C Dell 65W Original',
            status: 'Resolvido',
            notes: 'Separado com o equipamento',
          },
        ],
        batches: [{ batch_number: 'LOTE-NOT-2026-01', quantity: 1, location: 'Prateleira N-01' }],
      },
      {
        sku: 'BS0V6K3',
        code: 'EQ-2026-F9068',
        name: 'Notebook Dell Latitude 5320 (Intel Core I7 11ª Geração 16GB SSD 256 Tela 13.3")',
        brand: 'Dell',
        model: 'Latitude 5320',
        category: 'Notebooks',
        condition: 'Bom',
        aesthetic_grade: 'B - Bom',
        battery_health: '92%',
        screen_size: '13.3"',
        processor: 'Core I7 11ª Geração',
        ram: '16GB DDR4',
        storage: 'SSD 256GB',
        unit_price: 3300.0,
        cost_price: 2000.0,
        status: 'Disponível',
        images: [
          'https://ambicorpflow.replit.app/api/storage/objects/uploads/68ac008c-f7d5-4d50-b313-0ac7ae8ae417',
        ],
        checklist: standardChecklist,
        history: standardHistory,
        parts: [],
        deliverables: [
          {
            item_name: 'Cabo de Força Tripolar',
            status: 'Pendente',
            notes: 'Aguardando chegada no estoque',
          },
        ],
        batches: [{ batch_number: 'LOTE-NOT-2026-02', quantity: 1, location: 'Prateleira N-02' }],
      },
      {
        sku: '8R6WZ23',
        code: 'EQ-2026-A34CF',
        name: 'Notebook Dell Latitude 5300 (Intel Core I7 8ª Geração 8GB SSD 256 Tela 14")',
        brand: 'Dell',
        model: 'Latitude 5300',
        category: 'Notebooks',
        condition: 'Excelente',
        aesthetic_grade: 'A - Excelente',
        battery_health: '95%',
        screen_size: '14"',
        processor: 'Core I7 8ª Geração',
        ram: '8GB DDR4',
        storage: 'SSD 256GB',
        unit_price: 1850.0,
        cost_price: 1100.0,
        status: 'Disponível',
        images: [
          'https://ambicorpflow.replit.app/api/storage/objects/uploads/0b33db14-a9f7-42ee-b3b3-4da70ff4d211',
        ],
        checklist: standardChecklistPerfect,
        history: standardHistory,
        parts: [
          {
            name: 'SSD 256GB NVMe Kingston',
            cost: 130.0,
            status: 'Instalado',
            notes: 'Upgrade efetuado',
          },
        ],
        deliverables: [
          { item_name: 'Carregador 65W Ponta Fina', status: 'Resolvido', notes: 'Incluso' },
        ],
        batches: [{ batch_number: 'LOTE-NOT-2026-03', quantity: 1, location: 'Prateleira N-03' }],
      },
      {
        sku: 'R90S2BGP',
        code: 'EQ-2026-8D7CA',
        name: 'Notebook Lenovo ThinkPad T580 (Intel Core I7 8ª Geração 16GB SSD 256Nvme Tela 15.6")',
        brand: 'Lenovo',
        model: 'ThinkPad T580',
        category: 'Notebooks',
        condition: 'Excelente',
        aesthetic_grade: 'A - Excelente',
        battery_health: '98%',
        screen_size: '15.6"',
        processor: 'Core I7 8ª Geração',
        ram: '16GB DDR4',
        storage: 'SSD 256GB',
        unit_price: 2800.0,
        cost_price: 1650.0,
        status: 'Disponível',
        images: [
          'https://ambicorpflow.replit.app/api/storage/objects/uploads/87f2bef6-24ba-48ad-8e69-48c6d17f7df9',
        ],
        checklist: standardChecklistPerfect,
        history: standardHistory,
        parts: [],
        deliverables: [
          {
            item_name: 'Carregador Lenovo USB-C 65W',
            status: 'Resolvido',
            notes: 'Original incluso',
          },
        ],
        batches: [{ batch_number: 'LOTE-NOT-2026-04', quantity: 1, location: 'Prateleira L-01' }],
      },
      {
        sku: 'R90S2BG9',
        code: 'EQ-2026-4063D',
        name: 'Notebook Lenovo ThinkPad T580 (Intel Core I7 8ª Geração 16GB SSD 256Nvme Tela 15.6")',
        brand: 'Lenovo',
        model: 'ThinkPad T580',
        category: 'Notebooks',
        condition: 'Excelente',
        aesthetic_grade: 'A - Excelente',
        battery_health: '96%',
        screen_size: '15.6"',
        processor: 'Core I7 8ª Geração',
        ram: '16GB DDR4',
        storage: 'SSD 256GB',
        unit_price: 2800.0,
        cost_price: 1650.0,
        status: 'Reservado',
        images: [
          'https://ambicorpflow.replit.app/api/storage/objects/uploads/c1bba44b-8c14-4de0-bb41-9913d8b0ecbc',
        ],
        checklist: standardChecklistPerfect,
        history: standardHistory,
        parts: [],
        deliverables: [
          {
            item_name: 'Adaptador HDMI Lenovo',
            status: 'Pendente',
            notes: 'Solicitado pelo cliente na reserva',
          },
        ],
        batches: [{ batch_number: 'LOTE-NOT-2026-05', quantity: 1, location: 'Prateleira L-02' }],
      },
      {
        sku: 'R90Y8E5N',
        code: 'EQ-2026-0150A',
        name: 'Notebook Lenovo ThinkPad P1 Gen2 (Intel Core I7 9ª Geração 16GB SSD 256Nvme Tela 15.6")',
        brand: 'Lenovo',
        model: 'ThinkPad P1 Gen2',
        category: 'Notebooks',
        condition: 'Excelente',
        aesthetic_grade: 'A - Excelente',
        battery_health: '94%',
        screen_size: '15.6"',
        processor: 'Core I7 9ª Geração',
        ram: '16GB DDR4',
        storage: 'SSD 256GB',
        unit_price: 2800.0,
        cost_price: 1750.0,
        status: 'Disponível',
        images: [
          'https://ambicorpflow.replit.app/api/storage/objects/uploads/2e6dee72-41a1-49d8-afca-ca82f53be6ea',
        ],
        checklist: standardChecklistPerfect,
        history: standardHistory,
        parts: [],
        deliverables: [
          {
            item_name: 'Carregador Lenovo Slim Tip 135W',
            status: 'Resolvido',
            notes: 'Original de alta potência',
          },
        ],
        batches: [{ batch_number: 'LOTE-NOT-2026-06', quantity: 1, location: 'Prateleira L-03' }],
      },
      {
        sku: 'R90Y8E5W',
        code: 'EQ-2026-63D1C',
        name: 'Notebook Lenovo ThinkPad P1 Gen2 (Intel Core I7 9ª Geração 16GB SSD 256Nvme Tela 15.6")',
        brand: 'Lenovo',
        model: 'ThinkPad P1 Gen2',
        category: 'Notebooks',
        condition: 'Excelente',
        aesthetic_grade: 'A - Excelente',
        battery_health: '91%',
        screen_size: '15.6"',
        processor: 'Core I7 9ª Geração',
        ram: '16GB DDR4',
        storage: 'SSD 256GB',
        unit_price: 2800.0,
        cost_price: 1750.0,
        status: 'Disponível',
        images: [
          'https://ambicorpflow.replit.app/api/storage/objects/uploads/6b84df05-ed4f-4e5c-9183-4fbcc56fd948',
        ],
        checklist: standardChecklistPerfect,
        history: standardHistory,
        parts: [],
        deliverables: [
          { item_name: 'Carregador Lenovo Slim Tip 135W', status: 'Resolvido', notes: 'Incluso' },
        ],
        batches: [{ batch_number: 'LOTE-NOT-2026-07', quantity: 1, location: 'Prateleira L-04' }],
      },
      {
        sku: '88HDYR2',
        code: 'EQ-2026-068DA',
        name: 'Notebook Dell Inspiron 15-7572 (Intel Core I7 8ª Geração 8GB SSD 256 Tela 15.6")',
        brand: 'Dell',
        model: 'Inspiron 15-7572',
        category: 'Notebooks',
        condition: 'Excelente',
        aesthetic_grade: 'A - Excelente',
        battery_health: '90%',
        screen_size: '15.6"',
        processor: 'Core I7 8ª Geração',
        ram: '8GB DDR4',
        storage: 'SSD 256GB',
        unit_price: 1850.0,
        cost_price: 1050.0,
        status: 'Disponível',
        images: [
          'https://ambicorpflow.replit.app/api/storage/objects/uploads/0e6a7380-15e4-461c-be09-4e6a23fc10d0',
        ],
        checklist: standardChecklistPerfect,
        history: standardHistory,
        parts: [],
        deliverables: [{ item_name: 'Carregador Dell 65W', status: 'Resolvido', notes: 'Incluso' }],
        batches: [{ batch_number: 'LOTE-NOT-2026-08', quantity: 1, location: 'Prateleira D-02' }],
      },
      {
        sku: 'BRJ749LP28',
        code: 'EQ-2026-D3E7C',
        name: 'Notebook HP EliteBook 840 G4 (Intel Core I7 7ª Geração 8GB SSD 240 Tela 14")',
        brand: 'HP',
        model: 'EliteBook 840 G4',
        category: 'Notebooks',
        condition: 'Bom',
        aesthetic_grade: 'B - Bom',
        battery_health: '88%',
        screen_size: '14"',
        processor: 'Core I7 7ª Geração',
        ram: '8GB DDR4',
        storage: 'SSD 240GB',
        unit_price: 1500.0,
        cost_price: 850.0,
        status: 'Disponível',
        images: [
          'https://ambicorpflow.replit.app/api/storage/objects/uploads/25b0343b-d030-49ff-80fa-38fc3183968a',
        ],
        checklist: standardChecklist,
        history: standardHistory,
        parts: [
          {
            name: 'Teclado retroiluminado HP',
            cost: 110.0,
            status: 'Instalado',
            notes: 'Teclado revisado',
          },
        ],
        deliverables: [
          {
            item_name: 'Carregador Original HP 65W',
            status: 'Resolvido',
            notes: 'Pronto para entrega',
          },
        ],
        batches: [{ batch_number: 'LOTE-NOT-2026-09', quantity: 1, location: 'Prateleira H-01' }],
      },
      {
        sku: 'BHYVFM2',
        code: 'EQ-2026-83A8E',
        name: 'Notebook Dell Inspiron 15-5566 (Intel Core I5 7ª Geração 8GB SSD 240 Tela 15.6")',
        brand: 'Dell',
        model: 'Inspiron 15-5566',
        category: 'Notebooks',
        condition: 'Excelente',
        aesthetic_grade: 'A - Excelente',
        battery_health: '93%',
        screen_size: '15.6"',
        processor: 'Core I5 7ª Geração',
        ram: '8GB DDR4',
        storage: 'SSD 240GB',
        unit_price: 1500.0,
        cost_price: 800.0,
        status: 'Disponível',
        images: [
          'https://ambicorpflow.replit.app/api/storage/objects/uploads/a6861ce0-6e10-48f9-9244-3f03d5a56788',
        ],
        checklist: standardChecklistPerfect,
        history: standardHistory,
        parts: [],
        deliverables: [{ item_name: 'Carregador Dell 45W', status: 'Resolvido', notes: 'Incluso' }],
        batches: [{ batch_number: 'LOTE-NOT-2026-10', quantity: 1, location: 'Prateleira D-03' }],
      },
      {
        sku: 'D1XLVN2',
        code: 'EQ-2026-DE769',
        name: 'Notebook Dell Inspiron 15-5557 (Intel Core I5 7ª Geração 8GB SSD 240 Tela 15.6")',
        brand: 'Dell',
        model: 'Inspiron 15-5557',
        category: 'Notebooks',
        condition: 'Excelente',
        aesthetic_grade: 'A - Excelente',
        battery_health: '90%',
        screen_size: '15.6"',
        processor: 'Core I5 7ª Geração',
        ram: '8GB DDR4',
        storage: 'SSD 240GB',
        unit_price: 1500.0,
        cost_price: 800.0,
        status: 'Vendido',
        images: [
          'https://ambicorpflow.replit.app/api/storage/objects/uploads/5a9ab793-fb9c-4c69-8bf2-c9f0e22a10a1',
        ],
        checklist: standardChecklistPerfect,
        history: standardHistory,
        parts: [],
        deliverables: [
          { item_name: 'Carregador Dell 65W', status: 'Resolvido', notes: 'Entregue com nota' },
        ],
        batches: [{ batch_number: 'LOTE-NOT-2026-11', quantity: 0, location: 'Prateleira D-04' }],
      },
      {
        sku: 'GD4LDQ2',
        code: 'EQ-2026-0BC7A',
        name: 'Notebook Dell Inspiron 15-3576 (Intel Core I5 8ª Geração 8GB SSD 240 Tela 15.6")',
        brand: 'Dell',
        model: 'Inspiron 15-3576',
        category: 'Notebooks',
        condition: 'Excelente',
        aesthetic_grade: 'A - Excelente',
        battery_health: '92%',
        screen_size: '15.6"',
        processor: 'Core I5 8ª Geração',
        ram: '8GB DDR4',
        storage: 'SSD 240GB',
        unit_price: 1690.0,
        cost_price: 920.0,
        status: 'Disponível',
        images: [
          'https://ambicorpflow.replit.app/api/storage/objects/uploads/f79da0ca-d06c-440b-9da0-3018dee0c9f6',
        ],
        checklist: standardChecklistPerfect,
        history: standardHistory,
        parts: [],
        deliverables: [
          { item_name: 'Carregador Dell Original', status: 'Resolvido', notes: 'Incluso' },
        ],
        batches: [{ batch_number: 'LOTE-NOT-2026-12', quantity: 1, location: 'Prateleira D-05' }],
      },
    ]

    for (const item of notebookItems) {
      let prodRecord
      try {
        prodRecord = app.findFirstRecordByData('products', 'sku', item.sku)
      } catch (_) {
        prodRecord = new Record(productsCol)
      }

      prodRecord.set('sku', item.sku)
      prodRecord.set('code', item.code)
      prodRecord.set('name', item.name)
      prodRecord.set('brand', item.brand)
      prodRecord.set('model', item.model)
      prodRecord.set('category', item.category)
      prodRecord.set('condition', item.condition)
      prodRecord.set('aesthetic_grade', item.aesthetic_grade)
      prodRecord.set('battery_health', item.battery_health)
      prodRecord.set('screen_size', item.screen_size)
      prodRecord.set('processor', item.processor)
      prodRecord.set('ram', item.ram)
      prodRecord.set('storage', item.storage)
      prodRecord.set('unit_price', item.unit_price)
      prodRecord.set('cost_price', item.cost_price)
      prodRecord.set('status', item.status)
      prodRecord.set('images', item.images)
      prodRecord.set('technical_checklist', item.checklist)
      prodRecord.set('history_events', item.history)
      app.save(prodRecord)

      // Batches
      for (const b of item.batches) {
        try {
          const bRec = app.findFirstRecordByData('batches', 'batch_number', b.batch_number)
          bRec.set('product_id', prodRecord.id)
          bRec.set('quantity', b.quantity)
          bRec.set('location', b.location)
          app.save(bRec)
        } catch (_) {
          const batchRecord = new Record(batchesCol)
          batchRecord.set('product_id', prodRecord.id)
          batchRecord.set('batch_number', b.batch_number)
          batchRecord.set('quantity', b.quantity)
          batchRecord.set('location', b.location)
          batchRecord.set('manufacturing_date', '2024-01-15 00:00:00.000Z')
          batchRecord.set('expiry_date', '2028-12-31 00:00:00.000Z')
          app.save(batchRecord)
        }
      }

      // Equipment parts
      for (const p of item.parts) {
        try {
          const pRec = new Record(partsCol)
          pRec.set('product_id', prodRecord.id)
          pRec.set('name', p.name)
          pRec.set('cost', p.cost)
          pRec.set('status', p.status)
          pRec.set('notes', p.notes)
          app.save(pRec)
        } catch (_) {}
      }

      // Deliverables
      for (const d of item.deliverables) {
        try {
          const dRec = new Record(delivCol)
          dRec.set('product_id', prodRecord.id)
          dRec.set('item_name', d.item_name)
          dRec.set('status', d.status)
          dRec.set('notes', d.notes)
          app.save(dRec)
        } catch (_) {}
      }
    }
  },
  (app) => {
    // Revert logic
  },
)
