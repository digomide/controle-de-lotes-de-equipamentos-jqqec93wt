// Hook acionado imediatamente após a criação de um registro em ml_orders_sync_jobs
// Busca pedidos reais da conta Mercado Livre conectada usando a API oficial /orders/search
// Persiste os pedidos de forma idempotente em ml_orders (chave única order_id)
// Atualiza progress_text em tempo real e calcula KPIs
// Tudo inline dentro do callback para respeitar a VM isolada do PocketBase

onRecordAfterCreateSuccess((e) => {
  const syncJob = e.record
  if (!syncJob || syncJob.getString('status') !== 'pending') {
    e.next()
    return
  }

  syncJob.set('status', 'processing')
  syncJob.set('progress_text', 'Conectando ao Mercado Livre para buscar pedidos...')
  $app.save(syncJob)

  // 1. Carregar ml_settings
  let settings = null
  try {
    const sRecords = $app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (sRecords && sRecords.length > 0) {
      settings = sRecords[0]
    }
  } catch (err) {
    console.log('[ml_orders_sync] Erro ao carregar ml_settings: ' + err)
  }

  if (!settings) {
    syncJob.set('status', 'error')
    syncJob.set('error_message', 'Configurações do Mercado Livre não encontradas.')
    syncJob.set('progress_text', 'Erro: ML não configurado.')
    $app.save(syncJob)
    e.next()
    return
  }

  let accessToken = settings.getString('access_token')
  const refreshToken = settings.getString('refresh_token')
  const clientId = settings.getString('client_id')
  const clientSecret = settings.getString('client_secret')
  const tokenExpiresAt = settings.getString('token_expires_at')
  const sellerId = settings.getString('user_id_ml')

  if (!accessToken || !sellerId) {
    syncJob.set('status', 'error')
    syncJob.set('error_message', 'Mercado Livre não está conectado ou não possui ID do vendedor.')
    syncJob.set('progress_text', 'Erro: Conta do Mercado Livre não conectada.')
    $app.save(syncJob)
    e.next()
    return
  }

  // 2. Renovar token se necessário
  let needRefresh = false
  if (tokenExpiresAt) {
    try {
      const expTime = new Date(tokenExpiresAt).getTime()
      if (Date.now() + 5 * 60 * 1000 >= expTime) {
        needRefresh = true
      }
    } catch (_) {}
  }

  if (needRefresh && refreshToken && clientId && clientSecret) {
    try {
      const refRes = $http.send({
        url: 'https://api.mercadolibre.com/oauth/token',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
        }),
        timeout: 20,
      })
      if (refRes.statusCode === 200 && refRes.json) {
        accessToken = refRes.json.access_token || accessToken
        const newRef = refRes.json.refresh_token || refreshToken
        const expIn = Number(refRes.json.expires_in) || 21600
        const newExpDate = new Date(Date.now() + expIn * 1000).toISOString()
        settings.set('access_token', accessToken)
        settings.set('refresh_token', newRef)
        settings.set('token_expires_at', newExpDate)
        $app.save(settings)
        console.log('[ml_orders_sync] Token renovado com sucesso para buscar pedidos.')
      }
    } catch (rErr) {
      console.log('[ml_orders_sync] Erro ao renovar token ML: ' + rErr)
    }
  }

  // 3. Montar janela de busca (padrão 60 dias para cobrir histórico recente completo)
  const rawDays = syncJob.getInt('days_back')
  const daysBack = rawDays && rawDays > 0 ? rawDays : 60
  const dateFrom = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString()

  let ordersCollection = null
  try {
    ordersCollection = $app.findCollectionByNameOrId('ml_orders')
  } catch (cErr) {
    syncJob.set('status', 'error')
    syncJob.set('error_message', 'Coleção ml_orders não encontrada: ' + cErr)
    $app.save(syncJob)
    e.next()
    return
  }

  // 4. Paginação de pedidos na API oficial do Mercado Livre:
  // GET /orders/search?seller={seller_id}&order.date_created.from={dateFrom}&sort=date_desc&limit=50&offset=0
  let offset = 0
  const PAGE_LIMIT = 50
  const MAX_ORDERS = 500
  let totalFetched = 0
  let totalSavedOrUpdated = 0
  let page = 0

  try {
    while (totalFetched < MAX_ORDERS) {
      page++
      const url =
        'https://api.mercadolibre.com/orders/search?seller=' +
        encodeURIComponent(sellerId) +
        '&order.date_created.from=' +
        encodeURIComponent(dateFrom) +
        '&sort=date_desc&limit=' +
        PAGE_LIMIT +
        '&offset=' +
        offset

      syncJob.set(
        'progress_text',
        'Buscando pedidos no ML (página ' +
          page +
          (totalFetched > 0 ? ', ' + totalFetched + ' pedidos encontrados' : '') +
          ')...',
      )
      $app.save(syncJob)

      let res = null
      try {
        res = $http.send({
          url: url,
          method: 'GET',
          headers: {
            Authorization: 'Bearer ' + accessToken,
            Accept: 'application/json',
          },
          timeout: 25,
        })
      } catch (netErr) {
        throw new Error('Falha de rede ao consultar pedidos do ML: ' + (netErr.message || netErr))
      }

      if (res.statusCode >= 400) {
        const errJson = res.json || {}
        const msg =
          errJson.message || errJson.error_description || errJson.error || 'HTTP ' + res.statusCode
        throw new Error('Erro retornado pela API de pedidos do ML: ' + msg)
      }

      const body = res.json || {}
      const results = Array.isArray(body.results) ? body.results : []
      const paging = body.paging || {}
      const totalAvailable = paging.total || 0

      if (results.length === 0) {
        break
      }

      // Processar e persistir cada pedido
      for (let i = 0; i < results.length; i++) {
        const rawOrder = results[i]
        if (!rawOrder || !rawOrder.id) continue
        totalFetched++

        const orderIdStr = String(rawOrder.id)
        let orderDate = rawOrder.date_created || new Date().toISOString()
        let closedDate = rawOrder.date_closed || null
        const totalAmount = Number(rawOrder.total_amount || 0)
        const currencyId = rawOrder.currency_id || 'BRL'
        const orderStatus = rawOrder.status || 'paid'
        const statusDetail = (rawOrder.status_detail && rawOrder.status_detail.description) || ''

        // Comprador
        const buyer = rawOrder.buyer || {}
        const buyerId = buyer.id ? String(buyer.id) : ''
        const buyerNickname = buyer.nickname || ''
        const buyerName = [buyer.first_name, buyer.last_name].filter(Boolean).join(' ')
        let buyerDoc = ''
        if (buyer.billing_info && buyer.billing_info.doc_number) {
          buyerDoc = buyer.billing_info.doc_number
        }

        // Envio / Shipping
        const shipping = rawOrder.shipping || {}
        const shippingId = shipping.id ? String(shipping.id) : ''
        const shippingStatus =
          shipping.status || (shipping.shipping_mode ? 'to_be_agreed' : 'pending')
        const shippingSubstatus = shipping.substatus || ''
        const shippingMode = shipping.shipping_mode || shipping.mode || ''
        const receiverAddress = shipping.receiver_address || null

        // Itens do pedido
        const orderItems = []
        if (Array.isArray(rawOrder.order_items)) {
          for (let oi = 0; oi < rawOrder.order_items.length; oi++) {
            const rawItemWrap = rawOrder.order_items[oi]
            const it = rawItemWrap.item || {}
            orderItems.push({
              item_id: it.id || '',
              title: it.title || '',
              category_id: it.category_id || '',
              variation_id: it.variation_id || null,
              seller_sku: it.seller_sku || it.seller_custom_field || '',
              quantity: rawItemWrap.quantity || 1,
              unit_price: Number(rawItemWrap.unit_price || 0),
              full_unit_price: Number(rawItemWrap.full_unit_price || rawItemWrap.unit_price || 0),
              currency_id: rawItemWrap.currency_id || currencyId,
            })
          }
        }

        // Pagamentos
        const paymentsList = []
        if (Array.isArray(rawOrder.payments)) {
          for (let pIdx = 0; pIdx < rawOrder.payments.length; pIdx++) {
            const pay = rawOrder.payments[pIdx]
            paymentsList.push({
              id: pay.id ? String(pay.id) : '',
              payment_method_id: pay.payment_method_id || '',
              payment_type: pay.payment_type || '',
              status: pay.status || '',
              status_detail: pay.status_detail || '',
              transaction_amount: Number(pay.transaction_amount || 0),
              date_approved: pay.date_approved || null,
            })
          }
        }

        // Persistência idempotente: buscar se já existe
        let existing = null
        try {
          existing = $app.findFirstRecordByFilter('ml_orders', "order_id = '" + orderIdStr + "'")
        } catch (_) {}

        const targetRecord = existing || new Record(ordersCollection)

        targetRecord.set('order_id', orderIdStr)
        targetRecord.set('date_created', orderDate)
        if (closedDate) targetRecord.set('date_closed', closedDate)
        targetRecord.set('status', orderStatus)
        if (statusDetail) targetRecord.set('status_detail', statusDetail)
        targetRecord.set('total_amount', totalAmount)
        targetRecord.set('currency_id', currencyId)
        targetRecord.set('buyer_id', buyerId)
        targetRecord.set('buyer_nickname', buyerNickname)
        targetRecord.set('buyer_name', buyerName)
        if (buyerDoc) targetRecord.set('buyer_document', buyerDoc)
        targetRecord.set('shipping_id', shippingId)
        targetRecord.set('shipping_status', shippingStatus)
        targetRecord.set('shipping_substatus', shippingSubstatus)
        targetRecord.set('shipping_mode', shippingMode)
        if (receiverAddress) targetRecord.set('receiver_address', receiverAddress)
        targetRecord.set('items', orderItems)
        targetRecord.set('payments', paymentsList)
        if (rawOrder.feedback) targetRecord.set('feedback', rawOrder.feedback)
        if (rawOrder.tags) targetRecord.set('tags', rawOrder.tags)

        // Resumo enxuto do raw_order para auditoria
        targetRecord.set('raw_order', {
          id: orderIdStr,
          status: orderStatus,
          date_created: orderDate,
          total_amount: totalAmount,
          items_count: orderItems.length,
        })

        try {
          $app.save(targetRecord)
          totalSavedOrUpdated++
        } catch (saveErr) {
          console.log('[ml_orders_sync] Erro ao salvar pedido ' + orderIdStr + ': ' + saveErr)
        }
      }

      if (results.length < PAGE_LIMIT) break
      offset += results.length
      if (totalAvailable > 0 && offset >= totalAvailable) break
    }

    syncJob.set('status', 'done')
    syncJob.set('orders_fetched', totalFetched)
    syncJob.set('orders_saved', totalSavedOrUpdated)
    syncJob.set('error_message', '')
    syncJob.set(
      'progress_text',
      'Sincronização concluída com sucesso! ' +
        totalSavedOrUpdated +
        ' pedidos processados/atualizados dos últimos ' +
        daysBack +
        ' dias.',
    )
    $app.save(syncJob)
    console.log(
      '[ml_orders_sync] Concluído! Pedidos coletados: ' +
        totalFetched +
        ', salvos: ' +
        totalSavedOrUpdated,
    )
  } catch (err) {
    const errorMsg = String(err.message || err)
    console.log('[ml_orders_sync] Erro na sincronização de pedidos: ' + errorMsg)
    syncJob.set('status', 'error')
    syncJob.set('error_message', errorMsg)
    syncJob.set('progress_text', 'Falha ao sincronizar pedidos: ' + errorMsg)
    $app.save(syncJob)
  }

  e.next()
}, 'ml_orders_sync_jobs')
