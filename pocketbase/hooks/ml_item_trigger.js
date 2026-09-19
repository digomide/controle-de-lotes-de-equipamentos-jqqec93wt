// Hook acionado imediatamente após a criação de um registro em ml_item_queue
// Executa ações seguras no Mercado Livre:
// 1. Pausar, reativar ou fechar anúncio ('pause', 'activate', 'close')
// 2. Alterar preço do anúncio ('update_price') com validação de valor > 0
// 3. Alterar quantidade em estoque disponível do anúncio ('update_stock') com validação de qtd >= 0
// 4. Alterar preço e estoque conjuntamente ('update_price_stock')
// Suporta produto vinculado no catálogo local ou ml_item_id direto do anúncio
// Tudo inline dentro do callback para respeitar a VM isolada do PocketBase

onRecordAfterCreateSuccess((e) => {
  const itemAction = e.record
  if (!itemAction || itemAction.getString('status') !== 'pending') {
    e.next()
    return
  }

  itemAction.set('status', 'processing')
  $app.save(itemAction)

  // Determinar tenant_id da ação (direto do itemAction ou do produto)
  let itemTenantId = ''
  try {
    itemTenantId = itemAction.getString('tenant_id') || ''
  } catch (_) {}

  const productIdEarly = itemAction.getString('product')
  if (!itemTenantId && productIdEarly) {
    try {
      const prodCheck = $app.findRecordById('products', productIdEarly)
      if (prodCheck) {
        itemTenantId = prodCheck.getString('tenant_id') || ''
      }
    } catch (_) {}
  }

  let settings = null
  try {
    if (itemTenantId) {
      const sRecords = $app.findRecordsByFilter(
        'ml_settings',
        'tenant_id = {:tid}',
        '-created',
        1,
        0,
        { tid: itemTenantId },
      )
      if (sRecords && sRecords.length > 0) {
        settings = sRecords[0]
      }
    }
  } catch (err) {
    console.log(
      '[ml_item_hook] Erro ao carregar ml_settings para tenant ' + itemTenantId + ': ' + err,
    )
  }

  if (!settings) {
    itemAction.set('status', 'error')
    itemAction.set('error_message', 'Configurações do Mercado Livre não encontradas.')
    $app.save(itemAction)
    e.next()
    return
  }

  let accessToken = settings.getString('access_token')
  const refreshToken = settings.getString('refresh_token')
  const clientId = settings.getString('client_id')
  const clientSecret = settings.getString('client_secret')
  const tokenExpiresAt = settings.getString('token_expires_at')

  if (!accessToken) {
    itemAction.set('status', 'error')
    itemAction.set('error_message', 'Mercado Livre não conectado.')
    $app.save(itemAction)
    e.next()
    return
  }

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
      }
    } catch (rErr) {
      console.log('[ml_item_hook] Erro ao renovar token ML: ' + rErr)
    }
  }

  const productId = itemAction.getString('product')
  let product = null
  let mlListingId = (itemAction.getString('ml_item_id') || '').trim()

  if (productId) {
    try {
      product = $app.findRecordById('products', productId)
      if (!mlListingId) {
        mlListingId = product.getString('ml_listing_id')
      }
    } catch (_) {}
  }

  if (!mlListingId && productId) {
    // Tenta encontrar produto por id se mlListingId ainda estiver vazio
    try {
      const p = $app.findRecordById('products', productId)
      mlListingId = p.getString('ml_listing_id')
    } catch (_) {}
  }

  if (!mlListingId) {
    itemAction.set('status', 'error')
    itemAction.set('error_message', 'Anúncio não possui ml_listing_id / ml_item_id identificado.')
    $app.save(itemAction)
    e.next()
    return
  }

  const rawAction = itemAction.getString('action') // 'pause', 'activate', 'close', 'update_price', 'update_stock', 'update_price_stock'
  let targetStatus = ''
  const putBody = {}

  if (rawAction === 'pause') {
    targetStatus = 'paused'
    putBody.status = 'paused'
  } else if (rawAction === 'close') {
    targetStatus = 'closed'
    putBody.status = 'closed'
  } else if (rawAction === 'activate') {
    targetStatus = 'active'
    putBody.status = 'active'
  } else if (rawAction === 'update_price') {
    const newPrice = itemAction.getFloat('new_price')
    if (!newPrice || isNaN(newPrice) || newPrice <= 0) {
      itemAction.set('status', 'error')
      itemAction.set('error_message', 'Preço inválido para atualização: deve ser maior que zero.')
      $app.save(itemAction)
      e.next()
      return
    }
    putBody.price = Number(newPrice.toFixed(2))
  } else if (rawAction === 'update_stock') {
    const newQty = itemAction.getInt('new_quantity')
    if (newQty === undefined || newQty === null || isNaN(newQty) || newQty < 0) {
      itemAction.set('status', 'error')
      itemAction.set(
        'error_message',
        'Quantidade em estoque inválida: deve ser maior ou igual a zero.',
      )
      $app.save(itemAction)
      e.next()
      return
    }
    putBody.available_quantity = Number(newQty)
  } else if (rawAction === 'update_price_stock') {
    const newPrice = itemAction.getFloat('new_price')
    const newQty = itemAction.getInt('new_quantity')
    if (newPrice && !isNaN(newPrice) && newPrice > 0) {
      putBody.price = Number(newPrice.toFixed(2))
    }
    if (newQty !== undefined && newQty !== null && !isNaN(newQty) && newQty >= 0) {
      putBody.available_quantity = Number(newQty)
    }
    if (Object.keys(putBody).length === 0) {
      itemAction.set('status', 'error')
      itemAction.set(
        'error_message',
        'Nenhum dado válido de preço ou estoque fornecido para atualização.',
      )
      $app.save(itemAction)
      e.next()
      return
    }
  } else {
    itemAction.set('status', 'error')
    itemAction.set('error_message', 'Ação desconhecida: ' + rawAction)
    $app.save(itemAction)
    e.next()
    return
  }

  let updateRes = null
  try {
    updateRes = $http.send({
      url: 'https://api.mercadolibre.com/items/' + mlListingId,
      method: 'PUT',
      headers: {
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(putBody),
      timeout: 20,
    })
  } catch (uNetErr) {
    itemAction.set('status', 'error')
    itemAction.set(
      'error_message',
      'Falha de rede ao atualizar anúncio no ML: ' + (uNetErr.message || uNetErr),
    )
    $app.save(itemAction)
    e.next()
    return
  }

  if (updateRes.statusCode >= 400) {
    const errJson = updateRes.json || {}
    let errDetail = errJson.message || errJson.error_description || errJson.error || ''
    if (Array.isArray(errJson.cause) && errJson.cause.length > 0) {
      const causes = errJson.cause.map((c) => c.message || c.code || JSON.stringify(c)).join('; ')
      errDetail = (errDetail ? errDetail + ' — ' : '') + causes
    }
    itemAction.set('status', 'error')
    itemAction.set(
      'error_message',
      errDetail || 'Falha ao atualizar anúncio no ML (HTTP ' + updateRes.statusCode + ').',
    )
    $app.save(itemAction)
    e.next()
    return
  }

  // Atualizar dados no produto local se existir vínculo
  if (product) {
    if (targetStatus) {
      product.set('ml_listing_status', targetStatus)
    }
    if (putBody.price && (rawAction === 'update_price' || rawAction === 'update_price_stock')) {
      product.set('unit_price', putBody.price)
    }
    $app.save(product)
  }

  itemAction.set('status', 'done')
  itemAction.set('error_message', '')
  itemAction.set('result', {
    ml_listing_id: mlListingId,
    action: rawAction,
    sent_payload: putBody,
    status: targetStatus || 'updated',
    response_body: updateRes.json || {},
  })
  $app.save(itemAction)
  console.log(
    '[ml_item_hook] Anúncio ' + mlListingId + ' processado com sucesso: ação ' + rawAction,
  )

  e.next()
}, 'ml_item_queue')
