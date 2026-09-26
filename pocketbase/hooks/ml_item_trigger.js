// Hook acionado imediatamente após a criação de um registro em ml_item_queue
// Executa ações seguras no Mercado Livre:
// 1. Pausar, reativar ou fechar anúncio ('pause', 'activate', 'close')
// 2. Alterar preço do anúncio ('update_price') com validação de valor > 0
// 3. Alterar quantidade em estoque disponível do anúncio ('update_stock') com validação de qtd >= 0
// 4. Alterar preço e estoque conjuntamente ('update_price_stock')
// Suporta produto vinculado no catálogo local ou ml_item_id direto do anúncio
// Suporta anúncios de catálogo e anúncios com variações (atualização por variação específica)
// e fallback com diagnóstico claro de bloqueios por políticas do ML (PolicyAgent)
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
    if (!settings) {
      const fallbackRecords = $app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
      if (fallbackRecords && fallbackRecords.length > 0) {
        settings = fallbackRecords[0]
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

  // -------------------------------------------------------------------------
  // RESOLVEDOR MULTI-ESTRATÉGIA DE ATUALIZAÇÃO NO MERCADO LIVRE
  // 1. Consulta detalhes do item para verificar variations e catalog_listing
  // 2. Se houver variações: atualiza cada variação via PUT /items/{id}/variations/{var_id}
  // 3. Se não houver variações ou se for anúncio comum: tenta PUT /items/{id}
  // 4. Se falhar com PolicyAgent / PA_UNAUTHORIZED_RESULT_FROM_POLICIES:
  //    logar corpo completo no servidor e formatar mensagem clara e amigável em PT-BR.
  // -------------------------------------------------------------------------

  let itemDetails = null
  try {
    const itemInfoRes = $http.send({
      url: 'https://api.mercadolibre.com/items/' + mlListingId,
      method: 'GET',
      headers: { Authorization: 'Bearer ' + accessToken },
      timeout: 15,
    })
    if (itemInfoRes.statusCode === 200 && itemInfoRes.json) {
      itemDetails = itemInfoRes.json
    }
  } catch (gErr) {
    console.log('[ml_item_hook] Aviso ao consultar dados do item ' + mlListingId + ': ' + gErr)
  }

  const variations =
    itemDetails && Array.isArray(itemDetails.variations) ? itemDetails.variations : []
  const isCatalog = Boolean(
    (itemDetails && itemDetails.catalog_listing) || (itemDetails && itemDetails.catalog_product_id),
  )

  let updateRes = null
  let appliedStrategy = 'root'
  let strategyDetails = {}

  // Estratégia A: Se a ação envolve preço/estoque e há variações no item, atualizar por variação
  const isPriceOrStockAction =
    rawAction === 'update_price' ||
    rawAction === 'update_stock' ||
    rawAction === 'update_price_stock'

  if (isPriceOrStockAction && variations.length > 0) {
    appliedStrategy = 'variations'
    const varResults = []
    let allSucceeded = true
    let firstErrorRes = null

    for (let vIdx = 0; vIdx < variations.length; vIdx++) {
      const v = variations[vIdx]
      const varPayload = {}
      if (putBody.price !== undefined) varPayload.price = putBody.price
      if (putBody.available_quantity !== undefined)
        varPayload.available_quantity = putBody.available_quantity

      try {
        const vRes = $http.send({
          url: 'https://api.mercadolibre.com/items/' + mlListingId + '/variations/' + v.id,
          method: 'PUT',
          headers: {
            Authorization: 'Bearer ' + accessToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(varPayload),
          timeout: 20,
        })
        varResults.push({ id: v.id, status: vRes.statusCode, raw: vRes.raw })
        if (vRes.statusCode >= 400) {
          allSucceeded = false
          if (!firstErrorRes) firstErrorRes = vRes
        }
      } catch (vErr) {
        allSucceeded = false
        varResults.push({ id: v.id, status: 0, error: String(vErr) })
      }
    }

    strategyDetails = { variations: varResults }

    if (allSucceeded) {
      updateRes = { statusCode: 200, json: { variations_updated: varResults.length } }
    } else {
      updateRes = firstErrorRes || {
        statusCode: 400,
        json: { message: 'Falha ao atualizar variações do anúncio.' },
      }
    }
  }

  // Estratégia B: Se não usou variações (ou status pause/activate/close), tenta PUT /items/{id}
  if (!updateRes) {
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
  }

  // Estratégia C: Se deu 403 / erro no item raiz e há variações que ainda não foram tentadas, tentar nas variações
  if (
    updateRes &&
    updateRes.statusCode >= 400 &&
    appliedStrategy === 'root' &&
    isPriceOrStockAction &&
    variations.length > 0
  ) {
    console.log(
      '[ml_item_hook] PUT raiz falhou para item ' +
        mlListingId +
        '. Tentando atualizar via variações...',
    )
    let varFallbackSuccess = true
    let firstVarError = null
    const varResults = []

    for (let vIdx = 0; vIdx < variations.length; vIdx++) {
      const v = variations[vIdx]
      const varPayload = {}
      if (putBody.price !== undefined) varPayload.price = putBody.price
      if (putBody.available_quantity !== undefined)
        varPayload.available_quantity = putBody.available_quantity

      try {
        const vRes = $http.send({
          url: 'https://api.mercadolibre.com/items/' + mlListingId + '/variations/' + v.id,
          method: 'PUT',
          headers: {
            Authorization: 'Bearer ' + accessToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(varPayload),
          timeout: 20,
        })
        varResults.push({ id: v.id, status: vRes.statusCode })
        if (vRes.statusCode >= 400) {
          varFallbackSuccess = false
          if (!firstVarError) firstVarError = vRes
        }
      } catch (vErr) {
        varFallbackSuccess = false
        varResults.push({ id: v.id, status: 0, error: String(vErr) })
      }
    }

    if (varFallbackSuccess && varResults.length > 0) {
      updateRes = { statusCode: 200, json: { fallback_variations_updated: varResults.length } }
      appliedStrategy = 'variations_fallback'
    }
  }

  // Tratamento de Erros e Diagnóstico de Política do ML
  if (updateRes.statusCode >= 400) {
    const errJson = updateRes.json || {}
    const rawErrorStr = updateRes.raw || JSON.stringify(errJson)
    console.log(
      '[ml_item_hook] ERRO ML ao atualizar anúncio ' +
        mlListingId +
        ' (HTTP ' +
        updateRes.statusCode +
        '): ' +
        rawErrorStr,
    )

    let isPolicyAgent = false
    if (
      errJson.code === 'PA_UNAUTHORIZED_RESULT_FROM_POLICIES' ||
      errJson.blocked_by === 'PolicyAgent' ||
      (errJson.message &&
        errJson.message.indexOf('At least one policy returned UNAUTHORIZED') !== -1) ||
      rawErrorStr.indexOf('PA_UNAUTHORIZED_RESULT_FROM_POLICIES') !== -1
    ) {
      isPolicyAgent = true
    }

    let errDetail = ''
    if (isPolicyAgent) {
      if (isCatalog) {
        errDetail =
          'Este anúncio é de Catálogo e o ML bloqueou a edição direta (PolicyAgent 403). Atualize pelo painel do ML ou reconecte a conta para renovar as permissões de catálogo.'
      } else {
        errDetail =
          'O Mercado Livre bloqueou a edição deste anúncio por política de autorização (PolicyAgent 403). Verifique se o anúncio possui restrições ou reconecte a conta nas Configurações.'
      }
    } else {
      errDetail = errJson.message || errJson.error_description || errJson.error || ''
      if (Array.isArray(errJson.cause) && errJson.cause.length > 0) {
        const causes = errJson.cause.map((c) => c.message || c.code || JSON.stringify(c)).join('; ')
        errDetail = (errDetail ? errDetail + ' — ' : '') + causes
      }
      if (!errDetail) {
        errDetail = 'Falha ao atualizar anúncio no ML (HTTP ' + updateRes.statusCode + ').'
      }
    }

    itemAction.set('status', 'error')
    itemAction.set('error_message', errDetail)
    itemAction.set('result', {
      ml_listing_id: mlListingId,
      action: rawAction,
      applied_strategy: appliedStrategy,
      sent_payload: putBody,
      http_status: updateRes.statusCode,
      raw_error: errJson,
      is_policy_agent: isPolicyAgent,
      is_catalog: isCatalog,
    })
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
    applied_strategy: appliedStrategy,
    strategy_details: strategyDetails,
    sent_payload: putBody,
    status: targetStatus || 'updated',
    response_body: updateRes.json || {},
  })
  $app.save(itemAction)
  console.log(
    '[ml_item_hook] Anúncio ' +
      mlListingId +
      ' processado com sucesso (' +
      appliedStrategy +
      '): ação ' +
      rawAction,
  )

  e.next()
}, 'ml_item_queue')
