// Hook para consulta de status e configuração sanitizada do Magalu Marketplace
// Rota segura sob namespace /backend/v1/magalu/status e /magalu/status
// Lê internamente magalu_settings sem expor secrets (access_token, refresh_token, client_secret)

routerAdd('GET', '/backend/v1/magalu/status', (e) => {
  let authRecord = e.auth
  if (!authRecord) {
    try {
      let info = e.requestInfo()
      authRecord = info.auth
    } catch (_) {}
  }

  if (!authRecord || !authRecord.id) {
    return e.json(401, {
      ok: false,
      error: 'Acesso não autorizado: sessão expirada ou não autenticada.',
    })
  }

  const canonicalRedirectUri =
    'https://controle-de-lotes-de-equipamentos-25024.goskip.app/configuracoes'

  let settings = null
  try {
    const sRecords = $app.findRecordsByFilter('magalu_settings', '1=1', '-created', 1, 0)
    if (sRecords && sRecords.length > 0) {
      settings = sRecords[0]
    }
  } catch (err) {
    console.log('[magalu_status_hook] Erro ao carregar magalu_settings: ' + err)
  }

  if (!settings) {
    return e.json(200, {
      ok: true,
      configured: false,
      connected: false,
      client_id: '',
      client_secret_configured: false,
      redirect_uri: canonicalRedirectUri,
      seller_id: null,
      seller_name: null,
      token_expires_at: null,
      channel_id: '9fe0d853-732b-4e4a-a0b0-cff988ed043d',
      branch_id: '',
      environment: 'production',
      status: 'disconnected',
    })
  }

  const clientId = settings.getString('client_id')
  const clientSecret = settings.getString('client_secret')
  const accessToken = settings.getString('access_token')
  const sellerId = settings.getString('seller_id')
  const sellerName = settings.getString('seller_name')
  const tokenExpiresAt = settings.getString('token_expires_at')
  const scopes = settings.getString('scopes')
  const channelId = settings.getString('channel_id') || '9fe0d853-732b-4e4a-a0b0-cff988ed043d'
  const branchId = settings.getString('branch_id') || ''
  const environment = settings.getString('environment') || 'production'

  let redirectUri = settings.getString('redirect_uri')
  if (!redirectUri || redirectUri.includes('localhost') || redirectUri.includes('127.0.0.1')) {
    redirectUri = canonicalRedirectUri
  }

  const configured = !!(clientId && clientSecret)
  const connected = !!(accessToken && (sellerId || configured))

  let status = 'disconnected'
  if (connected) {
    status = 'connected'
  } else if (configured) {
    status = 'configured'
  }

  return e.json(200, {
    ok: true,
    configured,
    connected,
    client_id: clientId,
    client_secret_configured: !!clientSecret,
    redirect_uri: redirectUri,
    seller_id: sellerId,
    seller_name: sellerName,
    token_expires_at: tokenExpiresAt || null,
    scopes: scopes || null,
    channel_id: channelId,
    branch_id: branchId,
    environment,
    status,
  })
})

routerAdd('GET', '/magalu/status', (e) => {
  let authRecord = e.auth
  if (!authRecord) {
    try {
      let info = e.requestInfo()
      authRecord = info.auth
    } catch (_) {}
  }

  if (!authRecord || !authRecord.id) {
    return e.json(401, {
      ok: false,
      error: 'Acesso não autorizado: sessão expirada ou não autenticada.',
    })
  }

  const canonicalRedirectUri =
    'https://controle-de-lotes-de-equipamentos-25024.goskip.app/configuracoes'

  let settings = null
  try {
    const sRecords = $app.findRecordsByFilter('magalu_settings', '1=1', '-created', 1, 0)
    if (sRecords && sRecords.length > 0) {
      settings = sRecords[0]
    }
  } catch (err) {
    console.log('[magalu_status_hook] Erro ao carregar magalu_settings: ' + err)
  }

  if (!settings) {
    return e.json(200, {
      ok: true,
      configured: false,
      connected: false,
      client_id: '',
      client_secret_configured: false,
      redirect_uri: canonicalRedirectUri,
      seller_id: null,
      seller_name: null,
      token_expires_at: null,
      channel_id: '9fe0d853-732b-4e4a-a0b0-cff988ed043d',
      branch_id: '',
      environment: 'production',
      status: 'disconnected',
    })
  }

  const clientId = settings.getString('client_id')
  const clientSecret = settings.getString('client_secret')
  const accessToken = settings.getString('access_token')
  const sellerId = settings.getString('seller_id')
  const sellerName = settings.getString('seller_name')
  const tokenExpiresAt = settings.getString('token_expires_at')
  const scopes = settings.getString('scopes')
  const channelId = settings.getString('channel_id') || '9fe0d853-732b-4e4a-a0b0-cff988ed043d'
  const branchId = settings.getString('branch_id') || ''
  const environment = settings.getString('environment') || 'production'

  let redirectUri = settings.getString('redirect_uri')
  if (!redirectUri || redirectUri.includes('localhost') || redirectUri.includes('127.0.0.1')) {
    redirectUri = canonicalRedirectUri
  }

  const configured = !!(clientId && clientSecret)
  const connected = !!(accessToken && (sellerId || configured))

  let status = 'disconnected'
  if (connected) {
    status = 'connected'
  } else if (configured) {
    status = 'configured'
  }

  return e.json(200, {
    ok: true,
    configured,
    connected,
    client_id: clientId,
    client_secret_configured: !!clientSecret,
    redirect_uri: redirectUri,
    seller_id: sellerId,
    seller_name: sellerName,
    token_expires_at: tokenExpiresAt || null,
    scopes: scopes || null,
    channel_id: channelId,
    branch_id: branchId,
    environment,
    status,
  })
})
