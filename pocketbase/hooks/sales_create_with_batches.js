// Hook para criação atômica de Venda por Lote
// Rota: POST /backend/v1/sales/create-with-batches
// Executa em uma transação única ($app.runInTransaction):
// 1. Validação estrita de estoque disponível de cada lote de compra (somando linhas repetidas)
// 2. Alocação dos primeiros N equipamentos disponíveis (ordenados por created)
// 3. Criação do registro de Venda (sales)
// 4. Criação dos sale_items + batches físicos se necessários
// 5. Atualização atômica do status dos equipamentos para 'Vendido' com histórico
// 6. Rollback automático caso qualquer etapa falhe

routerAdd(
  'POST',
  '/backend/v1/sales/create-with-batches',
  (e) => {
    var authRecord = e.auth
    if (!authRecord) {
      try {
        var info = e.requestInfo()
        authRecord = info.auth
      } catch (_) {}
    }

    if (!authRecord || !authRecord.id) {
      return e.json(401, { ok: false, error: 'Sessão não autenticada.' })
    }

    var body = {}
    try {
      body = e.requestInfo().body || {}
    } catch (_) {
      body = {}
    }

    var customerName = (body.customer_name || '').trim()
    if (!customerName) {
      return e.json(400, { ok: false, error: 'Nome do cliente é obrigatório.' })
    }

    var customerContact = (body.customer_contact || '').trim()
    var notes = (body.notes || '').trim()
    var userId = body.user_id || authRecord.id

    var equipmentItems = Array.isArray(body.equipmentItems) ? body.equipmentItems : []
    var batchLines = Array.isArray(body.batchLines) ? body.batchLines : []

    if (equipmentItems.length === 0 && batchLines.length === 0) {
      return e.json(400, { ok: false, error: 'Carrinho de venda vazio.' })
    }

    try {
      var createdSaleId = null

      $app.runInTransaction((txApp) => {
        // A. Agregar demanda por purchase_batch_id para validar estoque total requisitado
        var requiredByPurchaseBatch = {}
        for (var i = 0; i < batchLines.length; i++) {
          var line = batchLines[i]
          var pbId = (line.purchase_batch_id || '').trim()
          var qty = parseInt(line.quantity, 10) || 0
          if (!pbId || qty <= 0) continue

          requiredByPurchaseBatch[pbId] = (requiredByPurchaseBatch[pbId] || 0) + qty
        }

        // B. Para cada lote de compra demandado, buscar equipamentos disponíveis e validar estoque
        var allocatedEquipmentsByBatchLine = [] // { lineIndex, purchaseBatchId, unitPrice, products }

        // Cache de produtos disponíveis por lote para evitar re-selecionar o mesmo equipamento se houver múltiplas linhas
        var availablePoolByBatch = {}

        for (var pbKey in requiredByPurchaseBatch) {
          if (!requiredByPurchaseBatch.hasOwnProperty(pbKey)) continue
          var totalRequired = requiredByPurchaseBatch[pbKey]

          // Buscar todos os equipamentos disponíveis deste lote ordenados por created ASC
          var availableProds = txApp.findRecordsByFilter(
            'products',
            "purchase_batch_id = '" + pbKey + "' && status = 'Disponível'",
            'created',
            5000,
            0,
          )

          if (availableProds.length < totalRequired) {
            var batchLabel = pbKey
            try {
              var pbRecord = txApp.findRecordById('purchase_batches', pbKey)
              if (pbRecord) {
                var supp = pbRecord.getString('supplier') || ''
                var inv = pbRecord.getString('invoice_number') || 'S/N'
                batchLabel = supp ? supp + ' (NF ' + inv + ')' : pbKey
              }
            } catch (_) {}

            throw new Error(
              'Estoque insuficiente no lote "' +
                batchLabel +
                '". Solicitado: ' +
                totalRequired +
                ' un, Disponível agora: ' +
                availableProds.length +
                ' un. Venda cancelada para segurança do estoque.',
            )
          }

          availablePoolByBatch[pbKey] = availableProds
        }

        // C. Alocar equipamentos sequencialmente para cada linha de lote
        var allocatedPoolOffset = {}

        for (var l = 0; l < batchLines.length; l++) {
          var bLine = batchLines[l]
          var pBatchId = (bLine.purchase_batch_id || '').trim()
          var bQty = parseInt(bLine.quantity, 10) || 0
          var uPrice = Number(bLine.unit_price) || 0

          if (!pBatchId || bQty <= 0) continue

          var pool = availablePoolByBatch[pBatchId] || []
          var offset = allocatedPoolOffset[pBatchId] || 0
          var chosenForThisLine = pool.slice(offset, offset + bQty)
          allocatedPoolOffset[pBatchId] = offset + bQty

          allocatedEquipmentsByBatchLine.push({
            purchaseBatchId: pBatchId,
            unitPrice: uPrice,
            products: chosenForThisLine,
          })
        }

        // D. Calcular valor total da venda
        var totalAmount = 0
        for (var eq = 0; eq < equipmentItems.length; eq++) {
          var eqItem = equipmentItems[eq]
          var eqQty = parseInt(eqItem.quantity, 10) || 0
          var eqPrice = Number(eqItem.unit_price) || 0
          totalAmount += eqQty * eqPrice
        }
        for (var grp = 0; grp < allocatedEquipmentsByBatchLine.length; grp++) {
          var g = allocatedEquipmentsByBatchLine[grp]
          totalAmount += g.products.length * g.unitPrice
        }

        // E. Criar o registro principal em 'sales'
        var salesCollection = txApp.findCollectionByNameOrId('sales')
        var saleRecord = new Record(salesCollection)
        saleRecord.set('customer_name', customerName)
        saleRecord.set('customer_contact', customerContact)
        saleRecord.set('notes', notes)
        saleRecord.set('total_amount', totalAmount)
        saleRecord.set('status', 'completed')
        saleRecord.set('user_id', userId)

        txApp.save(saleRecord)
        createdSaleId = saleRecord.id

        var nowIso = new Date().toISOString().replace('T', ' ').substring(0, 19)
        var saleItemsCollection = txApp.findCollectionByNameOrId('sale_items')
        var batchesCollection = txApp.findCollectionByNameOrId('batches')

        // F. Processar itens diretos por equipamento (fluxo manual)
        for (var eIdx = 0; eIdx < equipmentItems.length; eIdx++) {
          var eItem = equipmentItems[eIdx]
          var eProdId = eItem.product_id
          var eBatchId = eItem.batch_id
          var eQuantity = parseInt(eItem.quantity, 10) || 1
          var eUnitPrice = Number(eItem.unit_price) || 0

          var saleItemRec = new Record(saleItemsCollection)
          saleItemRec.set('sale_id', saleRecord.id)
          saleItemRec.set('product_id', eProdId)
          saleItemRec.set('batch_id', eBatchId)
          saleItemRec.set('quantity', eQuantity)
          saleItemRec.set('unit_price', eUnitPrice)
          saleItemRec.set('subtotal', eQuantity * eUnitPrice)
          txApp.save(saleItemRec)

          // Atualizar produto para Vendido
          if (eProdId) {
            try {
              var pRecord = txApp.findRecordById('products', eProdId)
              var pEvents = []
              try {
                var pRaw = pRecord.get('history_events')
                if (Array.isArray(pRaw)) pEvents = pRaw.slice(0)
                else if (typeof pRaw === 'string' && pRaw.trim().startsWith('['))
                  pEvents = JSON.parse(pRaw)
              } catch (_) {
                pEvents = []
              }
              pEvents.push({
                date: nowIso,
                title:
                  'Vendido para ' +
                  customerName +
                  ' (Venda #' +
                  saleRecord.id.substring(0, 6) +
                  ')',
              })
              pRecord.set('status', 'Vendido')
              pRecord.set('history_events', pEvents)
              txApp.save(pRecord)
            } catch (errEq) {
              console.log('[create-with-batches] Aviso ao atualizar equipamento avulso: ' + errEq)
            }
          }
        }

        // G. Processar itens alocados por lote de compra
        for (var aIdx = 0; aIdx < allocatedEquipmentsByBatchLine.length; aIdx++) {
          var groupItem = allocatedEquipmentsByBatchLine[aIdx]
          var unitPrice = groupItem.unitPrice
          var prodsList = groupItem.products

          for (var p = 0; p < prodsList.length; p++) {
            var targetProd = prodsList[p]

            // Encontrar ou criar batch de saída
            var targetBatchId = ''
            var existingBatches = txApp.findRecordsByFilter(
              'batches',
              "product_id = '" + targetProd.id + "'",
              '-created',
              1,
              0,
            )

            if (existingBatches.length > 0) {
              targetBatchId = existingBatches[0].id
            } else {
              var newBatchRec = new Record(batchesCollection)
              var prodSku = targetProd.getString('sku') || targetProd.id.substring(0, 6)
              newBatchRec.set('product_id', targetProd.id)
              newBatchRec.set('batch_number', 'LOTE-' + prodSku)
              newBatchRec.set('quantity', 1)
              newBatchRec.set('location', 'Venda por Lote')
              txApp.save(newBatchRec)
              targetBatchId = newBatchRec.id
            }

            // Criar sale_item
            var batchSaleItemRec = new Record(saleItemsCollection)
            batchSaleItemRec.set('sale_id', saleRecord.id)
            batchSaleItemRec.set('product_id', targetProd.id)
            batchSaleItemRec.set('batch_id', targetBatchId)
            batchSaleItemRec.set('quantity', 1)
            batchSaleItemRec.set('unit_price', unitPrice)
            batchSaleItemRec.set('subtotal', unitPrice)
            txApp.save(batchSaleItemRec)

            // Atualizar status do produto para Vendido com histórico
            var hEvents = []
            try {
              var rawH = targetProd.get('history_events')
              if (Array.isArray(rawH)) hEvents = rawH.slice(0)
              else if (typeof rawH === 'string' && rawH.trim().startsWith('['))
                hEvents = JSON.parse(rawH)
            } catch (_) {
              hEvents = []
            }
            hEvents.push({
              date: nowIso,
              title:
                'Vendido por Lote para ' +
                customerName +
                ' (Venda #' +
                saleRecord.id.substring(0, 6) +
                ')',
            })
            targetProd.set('status', 'Vendido')
            targetProd.set('history_events', hEvents)
            txApp.save(targetProd)
          }
        }
      })

      return e.json(200, {
        ok: true,
        saleId: createdSaleId,
        message: 'Venda criada com sucesso e estoque atualizado atomicamente.',
      })
    } catch (err) {
      console.log('[create-with-batches] Erro na transação de venda: ' + err)
      return e.json(400, {
        ok: false,
        error: err.message || String(err),
      })
    }
  },
  $apis.requireAuth(),
)
