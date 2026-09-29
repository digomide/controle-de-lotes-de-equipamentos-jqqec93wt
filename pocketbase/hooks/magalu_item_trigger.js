// Hook acionado imediatamente após a criação de um registro em magalu_item_queue
// Executa ações na API oficial do Magalu:
// 1. Alterar preço: PATCH https://api.magalu.com/seller/v1/portfolios/prices/:sku
// 2. Alterar estoque: PATCH https://api.magalu.com/seller/v1/portfolios/stocks/:sku
// 3. Alterar ambos ('update_price_stock')
// 4. Pausar ou ativar (via estoque 0 ou status)

onRecordAfterCreateSuccess((e) => {
  const itemAction = e.record
  if (!itemAction || itemAction.getString('status') !== 'pending') {
    e.next()
    return
  }

  itemAction.set('status', 'processing')
  $app.save(itemAction)

  let settings = null
  try {
    const sRecords = $app.findRecordsByFilter('magalu_settings', '1=1', '-created', 1, 0)
    if (sRecords && sRecords.length > 0) {
      settings = sRecords[0]
    }
  } catch (err) {
    console.log('[magalu_item_trigger] Erro ao carregar magalu_settings: ' + err)
  }

  if (!settings) {
    itemAction.set('status', 'error')
    itemAction.set(
      'error_message',
      'Configurações do Magalu não encontradas. Configure suas credenciais em Configurações > Magalu.',
    )
    $app.save(itemAction)
    e.next()
    return
  }

  let accessToken = settings.getString('access_token')
  const refreshToken = settings.getString('refresh_token')
  const clientId = settings.getString('client_id')
  const clientSecret = settings.getString('client_secret')
  const tokenExpiresAt = settings.getString('token_expires_at')
  const channelId = settings.getString('channel_id') || '9fe0d853-732b-4e4a-a0b0-cff988ed043d'
  const branchId = settings.getString('branch_id') || ''

  if (!accessToken) {
    itemAction.set('status', 'error')
    itemAction.set('error_message', 'Conta do Magalu não conectada.')
    $app.save(itemAction)
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
      console.log('[magalu_item_trigger] Erro ao renovar token Magalu: ' + rErr)
    }
  }

  const sku = (itemAction.getString('sku') || '').trim()
  if (!sku) {
    itemAction.set('status', 'error')
    itemAction.set('error_message', 'SKU do produto Magalu não fornecido.')
    $app.save(itemAction)
    e.next()
    return
  }

  const rawAction = itemAction.getString('action')
  let priceSuccess = true
  let stockSuccess = true
  let errorMsgList = []
  const opResults = {}

  // 1. Operação de Preço
  if (rawAction === 'update_price' || rawAction === 'update_price_stock') {
    const newPrice = itemAction.getFloat('new_price')
    if (!newPrice || isNaN(newPrice) || newPrice <= 0) {
      itemAction.set('status', 'error')
      itemAction.set('error_message', 'Preço inválido para atualização: deve ser maior que zero.')
      $app.save(itemAction)
      e.next()
      return
    }

    const priceCents = Math.round(newPrice * 100)
    let listPriceCents = priceCents
    const newListPrice = itemAction.getFloat('new_list_price')
    if (newListPrice && !isNaN(newListPrice) && newListPrice >= newPrice) {
      listPriceCents = Math.round(newListPrice * 100)
    }

    const pricePayload = {
      channel: {
        id: channelId,
      },
      currency: 'BRL',
      list_price: listPriceCents,
      normalizer: 100,
      price: priceCents,
    }

    try {
      const pRes = $http.send({
        url: 'https://api.magalu.com/seller/v1/portfolios/prices/' + encodeURIComponent(sku),
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer ' + accessToken,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(pricePayload),
        timeout: 25,
      })

      opResults.price_http_status = pRes.statusCode
      opResults.price_response = pRes.json || pRes.raw

      if (pRes.statusCode >= 400 && pRes.statusCode !== 202) {
        priceSuccess = false
        const errJson = pRes.json || {}
        let desc =
          errJson.message ||
          'Erro ao atualizar preço na API Magalu (status ' + pRes.statusCode + ')'
        if (pRes.statusCode === 403) {
          desc =
            'Permissão negada (403) ao atualizar preço no Magalu. Verifique o escopo open:portfolio-prices-seller:write.'
        } else if (pRes.statusCode === 422) {
          desc =
            'Dados de preço rejeitados pelo Magalu (422). Verifique se o SKU existe e os campos channel_id/moeda estão corretos.'
        }
        errorMsgList.push(desc)
      }
    } catch (pErr) {
      priceSuccess = false
      errorMsgList.push('Falha na requisição de preço ao Magalu: ' + (pErr.message || pErr))
    }
  }

  // 2. Operação de Estoque
  if (
    rawAction === 'update_stock' ||
    rawAction === 'update_price_stock' ||
    rawAction === 'pause' ||
    rawAction === 'activate'
  ) {
    let newQty = 0
    if (rawAction === 'pause') {
      newQty = 0
    } else if (rawAction === 'activate') {
      newQty = itemAction.getInt('new_quantity') || 1
    } else {
      newQty = itemAction.getInt('new_quantity')
    }

    if (newQty === undefined || newQty === null || isNaN(newQty) || newQty < 0) {
      if (rawAction === 'update_stock') {
        itemAction.set('status', 'error')
        itemAction.set(
          'error_message',
          'Quantidade em estoque inválida: deve ser maior ou igual a zero.',
        )
        $app.save(itemAction)
        e.next()
        return
      }
    } else {
      const stockPayload = {
        channel: {
          id: channelId,
        },
        quantity: Math.round(newQty),
        type: 'AVAILABLE',
      }
      if (branchId) {
        stockPayload.branch = { id: branchId }
      }

      try {
        const sRes = $http.send({
          url: 'https://api.magalu.com/seller/v1/portfolios/stocks/' + encodeURIComponent(sku),
          method: 'PATCH',
          headers: {
            Authorization: 'Bearer ' + accessToken,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(stockPayload),
          timeout: 25,
        })

        opResults.stock_http_status = sRes.statusCode
        opResults.stock_response = sRes.json || sRes.raw

        if (sRes.statusCode >= 400 && sRes.statusCode !== 202) {
          stockSuccess = false
          const errJson = sRes.json || {}
          let desc =
            errJson.message ||
            'Erro ao atualizar estoque na API Magalu (status ' + sRes.statusCode + ')'
          if (sRes.statusCode === 403) {
            desc =
              'Permissão negada (403) ao atualizar estoque no Magalu. Verifique o escopo open:portfolio-stocks-seller:write.'
          } else if (sRes.statusCode === 422) {
            desc =
              'Dados de estoque rejeitados pelo Magalu (422). Verifique se o SKU e o ID do canal/branch estão corretos.'
          }
          errorMsgList.push(desc)
        }
      } catch (sErr) {
        stockSuccess = false
        errorMsgList.push('Falha na requisição de estoque ao Magalu: ' + (sErr.message || sErr))
      }
    }
  }

  // 3. Resultado consolidado
  itemAction.set('result', opResults)

  if (priceSuccess && stockSuccess) {
    itemAction.set('status', 'done')
    itemAction.set('error_message', '')
    $app.save(itemAction)
    console.log(
      '[magalu_item_trigger] SKU ' + sku + ' atualizado com sucesso no Magalu! Ação: ' + rawAction,
    )
  } else {
    itemAction.set('status', 'error')
    itemAction.set('error_message', errorMsgList.join(' | '))
    $app.save(itemAction)
    console.log(
      '[magalu_item_trigger] Erro na atualização de ' + sku + ': ' + errorMsgList.join(' | '),
    )
  }

  e.next()
}, 'magalu_item_queue')
