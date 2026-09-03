// Hook fired whenever an inventory_adjustment record is created
// Synchronizes the batch quantity based on quantity_change or physical_count
onRecordCreate((e) => {
  const adj = e.record
  const batchId = adj.getString('batch_id')
  const qtyChange = adj.getInt('quantity_change')
  const physicalCount = adj.getInt('physical_count')
  const type = adj.getString('type')

  if (batchId) {
    try {
      const batch = $app.findRecordById('batches', batchId)
      const currentQty = batch.getInt('quantity')

      let newQty = currentQty
      if (type === 'count_adjustment' && physicalCount >= 0) {
        newQty = physicalCount
      } else {
        newQty = Math.max(0, currentQty + qtyChange)
      }

      batch.set('quantity', newQty)
      $app.save(batch)
    } catch (err) {
      console.log('Error updating batch quantity on inventory adjustment: ' + err)
    }
  }

  e.next()
}, 'inventory_adjustments')
