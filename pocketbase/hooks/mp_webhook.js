// Webhook do Mercado Pago para receber notificações de pagamentos
// Route: POST /api/store/mp/webhook
// Route: GET /api/store/mp/webhook (para validação/ping da URL pelo MP)
// Público, sem autenticação PocketBase (recebe requisições diretas dos servidores do Mercado Pago)

routerAdd('GET', '/api/store/mp/webhook', (e) => {
  return e.json(200, { status: 'ok', service: 'AMbicorpFlow Mercado Pago Webhook' })
})

routerAdd('POST', '/api/store/mp/webhook', (e) => {
  let body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (_) {
    body = {}
  }

  const query = e.requestInfo().query || {}

  // Mercado Pago pode enviar dados via query string ou no body
  // Ex: ?data.id=123456789&type=payment OU body: { "action": "payment.created", "data": { "id": "123456789" }, "type": "payment" }
  let paymentId = ''
  let topic = (query.topic || query.type || body.type || body.action || '').toString()

  if (query['data.id']) {
    paymentId = String(query['data.id'])
  } else if (body.data && body.data.id) {
    paymentId = String(body.data.id)
  } else if (query.id) {
    paymentId = String(query.id)
  }

  console.log('[mp_webhook] Recebido webhook: topic=' + topic + ' paymentId=' + paymentId)

  // Se for notificação de pagamento e temos o ID, vamos consultar a API do MP para validar e obter dados reais
  if (paymentId && (topic.indexOf('payment') >= 0 || !topic)) {
    // 1. Obter Access Token configurado
    let accessToken = ''
    try {
      const sRecords = $app.findRecordsByFilter('mercadopago_settings', '1=1', '-created', 1, 0)
      if (sRecords && sRecords.length > 0) {
        accessToken = sRecords[0].getString('mp_access_token').trim()
      }
    } catch (sErr) {
      console.log('[mp_webhook] Erro ao buscar mercadopago_settings: ' + sErr)
    }

    if (!accessToken) {
      console.log('[mp_webhook] Alerta: Webhook recebido mas mp_access_token não está configurado.')
      return e.json(200, { status: 'skipped_no_token' })
    }

    // 2. Consultar o pagamento na API oficial do Mercado Pago para verificação autêntica
    try {
      const payRes = $http.send({
        url: 'https://api.mercadopago.com/v1/payments/' + paymentId,
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + accessToken,
          Accept: 'application/json',
        },
        timeout: 15,
      })

      if (payRes.statusCode === 200 && payRes.json) {
        const payData = payRes.json
        const paymentStatus = payData.status // 'approved', 'pending', 'rejected', 'cancelled', etc.
        const statusDetail = payData.status_detail || ''
        const externalReference = payData.external_reference || '' // ID do store_orders
        const paymentMethod = payData.payment_method_id || ''
        const dateApproved = payData.date_approved || ''

        console.log(
          '[mp_webhook] Pagamento ' +
            paymentId +
            ' consultado: status=' +
            paymentStatus +
            ' extRef=' +
            externalReference,
        )

        // 3. Localizar o pedido interno pelo external_reference ou pelo payment_id / preference_id
        let order = null
        if (externalReference) {
          try {
            order = $app.findRecordById('store_orders', externalReference)
          } catch (_) {}
        }

        if (!order) {
          try {
            const orders = $app.findRecordsByFilter(
              'store_orders',
              "mp_payment_id = '" + paymentId + "'",
              '-created',
              1,
              0,
            )
            if (orders && orders.length > 0) {
              order = orders[0]
            }
          } catch (_) {}
        }

        if (order) {
          // Mapear status do MP para status do store_orders
          // status enum: ['pendente', 'aprovado', 'recusado', 'cancelado', 'expirado']
          let newStatus = order.getString('status')
          if (paymentStatus === 'approved') {
            newStatus = 'aprovado'
          } else if (paymentStatus === 'rejected') {
            newStatus = 'recusado'
          } else if (paymentStatus === 'cancelled') {
            newStatus = 'cancelado'
          } else if (paymentStatus === 'in_process' || paymentStatus === 'pending') {
            newStatus = 'pendente'
          }

          order.set('status', newStatus)
          order.set('mp_payment_id', String(paymentId))
          order.set('mp_status_detail', statusDetail)
          if (paymentMethod) {
            order.set('payment_method_id', paymentMethod)
          }
          if (paymentStatus === 'approved' && dateApproved) {
            order.set('paid_at', dateApproved)
          }

          // 4. Se foi APROVADO e ainda não deu baixa no estoque: realizar baixa de estoque!
          const alreadyDecremented = order.getBool('stock_decremented')
          if (newStatus === 'aprovado' && !alreadyDecremented) {
            const productId = order.getString('product_id')
            const orderBatchId = order.getString('batch_id')
            const qtyToDecrement = order.getInt('quantity') || 1

            console.log(
              '[mp_webhook] Processando baixa de estoque para pedido ' +
                order.id +
                ', produto=' +
                productId +
                ', qtd=' +
                qtyToDecrement,
            )

            let batchTarget = null
            if (orderBatchId) {
              try {
                batchTarget = $app.findRecordById('batches', orderBatchId)
              } catch (_) {}
            }

            // Se não tinha batch_id definido no pedido, encontra o primeiro lote com estoque do produto
            if (!batchTarget && productId) {
              try {
                const availableBatches = $app.findRecordsByFilter(
                  'batches',
                  "product_id = '" + productId + "' && quantity > 0",
                  'created',
                  1,
                  0,
                )
                if (availableBatches && availableBatches.length > 0) {
                  batchTarget = availableBatches[0]
                  order.set('batch_id', batchTarget.id)
                }
              } catch (bErr) {
                console.log('[mp_webhook] Erro ao buscar lote para o produto: ' + bErr)
              }
            }

            if (batchTarget) {
              const currentQty = batchTarget.getInt('quantity')
              const newQty = Math.max(0, currentQty - qtyToDecrement)
              batchTarget.set('quantity', newQty)
              try {
                $app.save(batchTarget)
                console.log(
                  '[mp_webhook] Estoque atualizado no lote ' +
                    batchTarget.getString('batch_number') +
                    ': de ' +
                    currentQty +
                    ' para ' +
                    newQty,
                )
              } catch (bSaveErr) {
                console.log('[mp_webhook] Erro ao salvar baixa do lote: ' + bSaveErr)
              }
            }

            // Verificar se o estoque total do produto zerou e atualizar status para 'Vendido'
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
                  console.log('[mp_webhook] Estoque total zerado. Produto marcado como Vendido!')
                }
              } catch (pErr) {
                console.log('[mp_webhook] Erro ao verificar estoque total do produto: ' + pErr)
              }
            }

            // Também registrar uma venda formal na coleção 'sales' e 'sale_items' para refletir no faturamento interno
            try {
              const salesCol = $app.findCollectionByNameOrId('sales')
              const saleRecord = new Record(salesCol)
              saleRecord.set('customer_name', order.getString('customer_name'))
              saleRecord.set(
                'customer_contact',
                order.getString('customer_phone') + ' / ' + order.getString('customer_email'),
              )
              saleRecord.set('total_amount', order.getFloat('total_amount'))
              saleRecord.set('status', 'completed')
              saleRecord.set(
                'notes',
                'Venda realizada na Loja Pública via Mercado Pago (Pedido: ' +
                  order.id +
                  ', MP ID: ' +
                  paymentId +
                  ')',
              )
              $app.save(saleRecord)

              const saleItemsCol = $app.findCollectionByNameOrId('sale_items')
              const itemRecord = new Record(saleItemsCol)
              itemRecord.set('sale_id', saleRecord.id)
              itemRecord.set('product_id', productId)
              if (batchTarget) {
                itemRecord.set('batch_id', batchTarget.id)
              }
              itemRecord.set('quantity', qtyToDecrement)
              itemRecord.set('unit_price', order.getFloat('unit_price'))
              itemRecord.set('subtotal', order.getFloat('total_amount'))
              $app.save(itemRecord)
              console.log(
                '[mp_webhook] Venda registrada com sucesso em sales/sale_items: ' + saleRecord.id,
              )
            } catch (saleErr) {
              console.log('[mp_webhook] Aviso: falha ao gerar registro em sales: ' + saleErr)
            }

            order.set('stock_decremented', true)
          }

          $app.save(order)
          console.log('[mp_webhook] Pedido ' + order.id + ' atualizado com status ' + newStatus)
        } else {
          console.log(
            '[mp_webhook] Pedido não encontrado para paymentId ' +
              paymentId +
              ' ou externalReference ' +
              externalReference,
          )
        }
      } else {
        console.log(
          '[mp_webhook] Falha ao consultar pagamento ' +
            paymentId +
            ': status ' +
            payRes.statusCode,
        )
      }
    } catch (payErr) {
      console.log('[mp_webhook] Exceção ao consultar API do MP: ' + payErr)
    }
  }

  // Mercado Pago espera status HTTP 200/201 para confirmar recebimento do webhook
  return e.json(200, { status: 'received' })
})
