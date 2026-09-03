// Hook fired whenever a sale_item record is created
// Decrements the quantity in the referenced batch record
onRecordCreate((e) => {
  const item = e.record
  const batchId = item.getString('batch_id')
  const qty = item.getInt('quantity')

  if (batchId && qty > 0) {
    try {
      const batch = $app.findRecordById('batches', batchId)
      const currentQty = batch.getInt('quantity')
      const newQty = Math.max(0, currentQty - qty)
      batch.set('quantity', newQty)
      $app.save(batch)
    } catch (err) {
      console.log('Error updating batch quantity on sale item create: ' + err)
    }
  }

  e.next()
}, 'sale_items')
