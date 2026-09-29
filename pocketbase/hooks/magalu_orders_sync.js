// Hook acionado imediatamente após a criação de um registro em magalu_orders_sync_jobs
// Sincroniza pedidos recentes do Magalu Marketplace via Open API:
// Endpoints oficiais:
// - GET https://api.magalu.com/seller/v1/orders
// - GET https://api.magalu.com/seller/v1/deliveries/packages/search ou DRE orders list
// Grava ou atualiza os pedidos na coleção `magalu_orders` com tolerância total a falhas.

onRecordAfterCreateSuccess((e) => {
  const job = e.record
  if (!job || job.getString('status') !== 'pending') {
    e.next()
    return
  }

  job.set('status', 'processing')
  job.set('progress_text', 'Conectando ao serviço de Pedidos Magalu...')
  $app.save(job)

  let settings = null
  try {
    const sRecords = $app.findRecordsByFilter('magalu_settings', '1=1', '-created', 1, 0)
    if (sRecords && sRecords.length > 0) {
      settings = sRecords[0]
    }
  } catch (err) {
    console.log('[magalu_orders_sync] Erro ao carregar magalu_settings: ' + err)
  }

  if (!settings) {
    job.set('status', 'error')
    job.set(
      'error_message',
      'Configurações do Magalu não encontradas. Configure suas credenciais em Configurações > Magalu.',
    )
    $app.save(job)
    e.next()
    return
  }

  let accessToken = settings.getString('access_token')
  const refreshToken = settings.getString('refresh_token')
  const clientId = settings.getString('client_id')
  const clientSecret = settings.getString('client_secret')
  const tokenExpiresAt = settings.getString('token_expires_at')

  if (!accessToken) {
    job.set('status', 'error')
    job.set('error_message', 'Conta do Magalu não conectada.')
    $app.save(job)
    e.next()
    return
  }

  // Renovação de token se necessário
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
        url: 'https://id.magalu.com/oauth/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body:
          'grant_type=refresh_token&client_id=' +
          encodeURIComponent(clientId) +
          '&client_secret=' +
          encodeURIComponent(clientSecret) +
          '&refresh_token=' +
          encodeURIComponent(refreshToken),
        timeout: 20,
      })
      if (refRes.statusCode === 200 && refRes.json) {
        accessToken = refRes.json.access_token || accessToken
        const newRef = refRes.json.refresh_token || refreshToken
        const expIn = Number(refRes.json.expires_in) || 7200
        const newExpDate = new Date(Date.now() + expIn * 1000).toISOString()
        settings.set('access_token', accessToken)
        settings.set('refresh_token', newRef)
        settings.set('token_expires_at', newExpDate)
        $app.save(settings)
      }
    } catch (rErr) {
      console.log('[magalu_orders_sync] Erro ao renovar token Magalu: ' + rErr)
    }
  }

  job.set('progress_text', 'Buscando pedidos na Open API Magalu...')
  $app.save(job)

  // Endpoints oficiais para listagem de pedidos
  const orderEndpoints = [
    'https://api.magalu.com/seller/v1/orders?_limit=50',
    'https://api.magalu.com/seller/v1/deliveries/packages/search?_limit=50',
    'https://api.magalu.com/seller/v1/orders/list?limit=50',
  ]

  let rawOrders = []
  let ordersEndpointHit = ''
  let lastStatus = 200
  let errorMessage = ''

  for (let i = 0; i < orderEndpoints.length; i++) {
    const url = orderEndpoints[i]
    try {
      const res = $http.send({
        url: url,
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + accessToken,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        timeout: 30,
      })
      lastStatus = res.statusCode
      if (res.statusCode === 200 && res.json) {
        ordersEndpointHit = url
        const list =
          res.json.results ||
          res.json.data ||
          res.json.orders ||
          res.json.items ||
          (Array.isArray(res.json) ? res.json : [])
        if (Array.isArray(list)) {
          rawOrders = list
          break
        }
      } else if (res.statusCode === 401 || res.statusCode === 403) {
        const errJson = res.json || {}
        errorMessage =
          errJson.message ||
          'Permissão negada para consultar pedidos no Magalu (HTTP ' +
            res.statusCode +
            '). Verifique se o escopo open:orders:read ou open:deliveries está ativo.'
        break
      }
    } catch (reqErr) {
      console.log('[magalu_orders_sync] Tentativa em ' + url + ' falhou: ' + reqErr)
    }
  }

  if (lastStatus === 401 || (lastStatus === 403 && rawOrders.length === 0 && errorMessage)) {
    job.set('status', 'error')
    job.set(
      'error_message',
      errorMessage ||
        'Permissão insuficiente na API de pedidos do Magalu. Verifique o cadastro no portal de desenvolvedores Magalu.',
    )
    $app.save(job)
    e.next()
    return
  }

  job.set('progress_text', 'Gravando ' + rawOrders.length + ' pedido(s) no banco local...')
  $app.save(job)

  const ordersCollection = $app.findCollectionByNameOrId('magalu_orders')
  let savedCount = 0

  for (let j = 0; j < rawOrders.length; j++) {
    const o = rawOrders[j]
    if (!o) continue
    const orderId = String(
      o.id || o.order_id || o.code || o.order_code || 'MAG-' + Date.now() + '-' + j,
    )
    const orderCode = String(o.code || o.order_code || o.id || orderId)

    // Data de criação
    let dateCreated = new Date().toISOString()
    if (o.created_at || o.date_created || o.order_date || o.created) {
      try {
        dateCreated = new Date(
          o.created_at || o.date_created || o.order_date || o.created,
        ).toISOString()
      } catch (_) {}
    }

    // Status
    const status = (o.status || o.order_status || 'approved').toLowerCase()

    // Valor total
    let total = 0
    if (o.total_amount !== undefined) total = Number(o.total_amount)
    else if (o.total !== undefined) total = Number(o.total)
    else if (o.amount !== undefined) total = Number(o.amount)
    else if (o.value !== undefined) total = Number(o.value)
    if (total > 10000 && !o.normalizer) {
      // centavos
      total = total / 100
    }

    // Comprador
    const buyerName = o.customer
      ? o.customer.name || o.customer.full_name
      : o.buyer_name || o.buyer || 'Cliente Magalu'
    const buyerDoc = o.customer
      ? o.customer.document || o.customer.cpf || o.customer.cnpj
      : o.buyer_document || ''

    // Itens
    let orderItems = []
    if (Array.isArray(o.items)) {
      orderItems = o.items.map(function (it) {
        return {
          sku: it.sku || it.sku_id || it.id || '',
          name: it.name || it.title || it.description || 'Produto',
          quantity: Number(it.quantity || it.amount || 1),
          unit_price:
            Number(it.unit_price || it.price || 0) > 1000
              ? Number(it.unit_price || it.price) / 100
              : Number(it.unit_price || it.price || 0),
          list_price:
            Number(it.list_price || 0) > 1000
              ? Number(it.list_price) / 100
              : Number(it.list_price || 0),
        }
      })
    } else if (Array.isArray(o.products)) {
      orderItems = o.products.map(function (it) {
        return {
          sku: it.sku || it.id || '',
          name: it.name || it.title || 'Produto',
          quantity: Number(it.quantity || 1),
          unit_price: Number(it.price || 0),
          list_price: Number(it.list_price || 0),
        }
      })
    }

    // Envio / Entrega
    const shippingStatus = o.delivery
      ? o.delivery.status || o.shipping_status
      : o.shipping_status || status
    const carrierName = o.delivery
      ? o.delivery.carrier || o.delivery.carrier_name
      : o.carrier_name || 'Magalu Entregas'
    const trackingUrl = o.delivery
      ? o.delivery.tracking_url || o.tracking_url
      : o.tracking_url || ''

    try {
      let existing = null
      try {
        existing = $app.findFirstRecordByData('magalu_orders', 'order_id', orderId)
      } catch (_) {}

      const rec = existing || new Record(ordersCollection)
      rec.set('order_id', orderId)
      rec.set('order_code', orderCode)
      rec.set('date_created', dateCreated)
      rec.set('date_updated', new Date().toISOString())
      rec.set('status', status)
      rec.set('total_amount', total)
      rec.set('currency', 'BRL')
      rec.set('buyer_name', buyerName)
      rec.set('buyer_document', buyerDoc)
      rec.set('shipping_status', shippingStatus)
      rec.set('carrier_name', carrierName)
      rec.set('tracking_url', trackingUrl)
      rec.set('items', orderItems)
      rec.set('raw_order', o)
      $app.save(rec)
      savedCount++
    } catch (saveErr) {
      console.log('[magalu_orders_sync] Erro ao salvar pedido ' + orderId + ': ' + saveErr)
    }
  }

  job.set('status', 'done')
  job.set('orders_fetched', rawOrders.length)
  job.set('orders_saved', savedCount)
  job.set(
    'progress_text',
    'Sincronização concluída: ' + savedCount + ' pedidos atualizados no sistema.',
  )
  job.set('error_message', '')
  $app.save(job)
  console.log(
    '[magalu_orders_sync] Job ' + job.id + ' finalizado: ' + savedCount + ' pedidos salvos.',
  )

  e.next()
}, 'magalu_orders_sync_jobs')
