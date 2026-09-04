// Hook acionado imediatamente após a criação de um registro em ml_item_queue
// Executa ação de pausar, reativar ou fechar anúncio no Mercado Livre
// Tudo inline dentro do callback para respeitar a VM isolada do PocketBase

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
    const sRecords = $app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (sRecords && sRecords.length > 0) {
      settings = sRecords[0]
    }
  } catch (err) {
    console.log('[ml_item_hook] Erro ao carregar ml_settings: ' + err)
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
  let mlListingId = ''
  if (productId) {
    try {
      product = $app.findRecordById('products', productId)
      mlListingId = product.getString('ml_listing_id')
    } catch (_) {}
  }

  if (!mlListingId) {
    itemAction.set('status', 'error')
    itemAction.set('error_message', 'Produto não possui ml_listing_id vinculado.')
    $app.save(itemAction)
    e.next()
    return
  }

  const rawAction = itemAction.getString('action') // 'pause', 'activate', 'close'
  let targetStatus = 'active'
  if (rawAction === 'pause') targetStatus = 'paused'
  else if (rawAction === 'close') targetStatus = 'closed'
  else if (rawAction === 'activate') targetStatus = 'active'

  let updateRes = null
  try {
    updateRes = $http.send({
      url: 'https://api.mercadolibre.com/items/' + mlListingId,
      method: 'PUT',
      headers: {
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: targetStatus }),
      timeout: 20,
    })
  } catch (uNetErr) {
    itemAction.set('status', 'error')
    itemAction.set(
      'error_message',
      'Falha de rede ao alterar status do anúncio: ' + (uNetErr.message || uNetErr),
    )
    $app.save(itemAction)
    e.next()
    return
  }

  if (updateRes.statusCode >= 400) {
    const errJson = updateRes.json || {}
    itemAction.set('status', 'error')
    itemAction.set(
      'error_message',
      errJson.error_description ||
        errJson.message ||
        errJson.error ||
        'Falha ao atualizar status no ML (HTTP ' + updateRes.statusCode + ').',
    )
    $app.save(itemAction)
    e.next()
    return
  }

  if (product) {
    product.set('ml_listing_status', targetStatus)
    $app.save(product)
  }

  itemAction.set('status', 'done')
  itemAction.set('error_message', '')
  itemAction.set('result', {
    ml_listing_id: mlListingId,
    status: targetStatus,
  })
  $app.save(itemAction)
  console.log(
    '[ml_item_hook] Status do anúncio ' + mlListingId + ' atualizado para ' + targetStatus,
  )

  e.next()
}, 'ml_item_queue')
