// Hook fired whenever a sale_item record is created
// 1. Decrements the quantity in the referenced batch record
// 2. If the product is a single-unit tracked item (e.g. Notebooks or has status 'Disponível'),
//    updates the product's status to 'Vendido' if remaining stock becomes 0
onRecordCreate((e) => {
  const item = e.record
  const batchId = item.getString('batch_id')
  const productId = item.getString('product_id')
  const qty = item.getInt('quantity')

  if (batchId && qty > 0) {
    try {
      const batch = $app.findRecordById('batches', batchId)
      const currentQty = batch.getInt('quantity')
      const newQty = Math.max(0, currentQty - qty)
      batch.set('quantity', newQty)
      $app.save(batch)

      // Also check product stock: if total remaining across batches is 0, set status to 'Vendido'
      if (productId) {
        try {
          const prod = $app.findRecordById('products', productId)
          const allBatches = $app.findRecordsByFilter(
            'batches',
            "product_id = '" + productId + "'",
            '',
            100,
            0,
          )
          let totalRemaining = 0
          for (let i = 0; i < allBatches.length; i++) {
            totalRemaining += allBatches[i].getInt('quantity')
          }
          if (totalRemaining <= 0) {
            prod.set('status', 'Vendido')
            $app.save(prod)
          }
        } catch (prodErr) {
          console.log('Error checking product status in stock_reduction: ' + prodErr)
        }
      }
    } catch (err) {
      console.log('Error updating batch quantity on sale item create: ' + err)
    }
  }

  e.next()
}, 'sale_items')
