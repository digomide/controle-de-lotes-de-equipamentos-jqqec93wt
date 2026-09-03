migrate(
  (app) => {
    try {
      const purchaseBatches = app.findCollectionByNameOrId('purchase_batches')
      const products = app.findCollectionByNameOrId('products')

      // Check if sample batch already exists
      try {
        app.findFirstRecordByData('purchase_batches', 'supplier', 'Dell Brasil Indústria Ltda')
        return // already seeded
      } catch (_) {}

      // Batch 1: 310826 (Reference in the screenshot: 310826 · 6/20 inventariados, Custo do lote R$ 21.100, Custo-base R$ 1.055)
      const batch1 = new Record(purchaseBatches)
      batch1.set('supplier', 'Dell Brasil Indústria Ltda')
      batch1.set('invoice_number', '310826')
      batch1.set('purchase_date', '2026-08-25 10:00:00.000Z')
      batch1.set('total_cost', 21100)
      batch1.set('expected_quantity', 20)
      batch1.set('status', 'em_processamento')
      app.save(batch1)

      // Batch 2: Lenovo Corp (Lote concluído)
      const batch2 = new Record(purchaseBatches)
      batch2.set('supplier', 'Lenovo Tecnologia Brasil')
      batch2.set('invoice_number', 'NF-884920')
      batch2.set('purchase_date', '2026-08-15 14:30:00.000Z')
      batch2.set('total_cost', 16500)
      batch2.set('expected_quantity', 10)
      batch2.set('status', 'concluido')
      app.save(batch2)

      // Batch 3: HP Soluções Corporativas
      const batch3 = new Record(purchaseBatches)
      batch3.set('supplier', 'HP Soluções Corporativas')
      batch3.set('invoice_number', 'NF-10492')
      batch3.set('purchase_date', '2026-08-28 09:15:00.000Z')
      batch3.set('total_cost', 18400)
      batch3.set('expected_quantity', 15)
      batch3.set('status', 'em_processamento')
      app.save(batch3)

      // Link some existing products to batch1 to reflect "6 inventariados"
      const existingProducts = app.findRecordsByFilter('products', '', '-created', 6, 0)
      for (const p of existingProducts) {
        p.set('purchase_batch_id', batch1.id)
        if (!p.getString('serial_number')) {
          p.set('serial_number', p.getString('sku') || 'SN-' + p.id)
        }
        p.set('includes_charger', true)
        app.save(p)
      }

      // Link next 10 products to batch2 if available
      const nextProducts = app.findRecordsByFilter(
        'products',
        "purchase_batch_id = ''",
        '-created',
        10,
        0,
      )
      for (const p of nextProducts) {
        p.set('purchase_batch_id', batch2.id)
        if (!p.getString('serial_number')) {
          p.set('serial_number', p.getString('sku') || 'SN-' + p.id)
        }
        app.save(p)
      }
    } catch (err) {
      console.log('Error seeding purchase_batches:', err)
    }
  },
  (app) => {
    // Revert logic
    try {
      const records = app.findRecordsByFilter('purchase_batches', '', '', 100, 0)
      for (const r of records) {
        app.delete(r)
      }
    } catch (_) {}
  },
)
