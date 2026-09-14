// Hook para consulta de status e configuração sanitizada do Mercado Livre
// Rota segura sob namespace /backend/v1/ml/status e /ml/status
// Lê internamente ml_settings sem expor secrets (access_token, refresh_token, client_secret)

routerAdd('GET', '/backend/v1/ml/status', (e) => {
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

  const canonicalProductionRedirectUri =
    'https://controle-de-lotes-de-equipamentos-25024.goskip.app/configuracoes'

  let settings = null
  try {
    const sRecords = $app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (sRecords && sRecords.length > 0) {
      settings = sRecords[0]
    }
  } catch (err) {
    console.log('[ml_status_hook] Erro ao carregar ml_settings: ' + err)
  }

  if (!settings) {
    return e.json(200, {
      ok: true,
      configured: false,
      connected: false,
      client_id: '',
      client_secret_configured: false,
      redirect_uri: canonicalProductionRedirectUri,
      redirect_uri_is_production: true,
      nickname: '',
      user_id_ml: '',
      token_expires_at: null,
      permalink_seller: '',
    })
  }

  const clientId = (settings.getString('client_id') || '').trim()
  const clientSecret = (settings.getString('client_secret') || '').trim()
  const accessToken = (settings.getString('access_token') || '').trim()
  const rawRedirectUri = (settings.getString('redirect_uri') || '').trim()
  const nickname = (settings.getString('nickname') || '').trim()
  const userIdMl = (settings.getString('user_id_ml') || '').trim()
  const tokenExpiresAt = settings.getString('token_expires_at') || null
  const permalinkSeller = (settings.getString('permalink_seller') || '').trim()

  const finalRedirectUri =
    rawRedirectUri && !rawRedirectUri.includes('--preview')
      ? rawRedirectUri
      : canonicalProductionRedirectUri

  const isConnected = Boolean(accessToken && clientId)
  const isConfigured = Boolean(clientId)
  const clientSecretConfigured = Boolean(clientSecret)

  return e.json(200, {
    ok: true,
    configured: isConfigured,
    connected: isConnected,
    client_id: clientId,
    client_secret_configured: clientSecretConfigured,
    redirect_uri: finalRedirectUri,
    redirect_uri_is_production: true,
    nickname: nickname,
    user_id_ml: userIdMl,
    token_expires_at: tokenExpiresAt,
    permalink_seller: permalinkSeller,
  })
})

routerAdd('GET', '/ml/status', (e) => {
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

  const canonicalProductionRedirectUri =
    'https://controle-de-lotes-de-equipamentos-25024.goskip.app/configuracoes'

  let settings = null
  try {
    const sRecords = $app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (sRecords && sRecords.length > 0) {
      settings = sRecords[0]
    }
  } catch (err) {
    console.log('[ml_status_hook] Erro ao carregar ml_settings: ' + err)
  }

  if (!settings) {
    return e.json(200, {
      ok: true,
      configured: false,
      connected: false,
      client_id: '',
      client_secret_configured: false,
      redirect_uri: canonicalProductionRedirectUri,
      redirect_uri_is_production: true,
      nickname: '',
      user_id_ml: '',
      token_expires_at: null,
      permalink_seller: '',
    })
  }

  const clientId = (settings.getString('client_id') || '').trim()
  const clientSecret = (settings.getString('client_secret') || '').trim()
  const accessToken = (settings.getString('access_token') || '').trim()
  const rawRedirectUri = (settings.getString('redirect_uri') || '').trim()
  const nickname = (settings.getString('nickname') || '').trim()
  const userIdMl = (settings.getString('user_id_ml') || '').trim()
  const tokenExpiresAt = settings.getString('token_expires_at') || null
  const permalinkSeller = (settings.getString('permalink_seller') || '').trim()

  const finalRedirectUri =
    rawRedirectUri && !rawRedirectUri.includes('--preview')
      ? rawRedirectUri
      : canonicalProductionRedirectUri

  const isConnected = Boolean(accessToken && clientId)
  const isConfigured = Boolean(clientId)
  const clientSecretConfigured = Boolean(clientSecret)

  return e.json(200, {
    ok: true,
    configured: isConfigured,
    connected: isConnected,
    client_id: clientId,
    client_secret_configured: clientSecretConfigured,
    redirect_uri: finalRedirectUri,
    redirect_uri_is_production: true,
    nickname: nickname,
    user_id_ml: userIdMl,
    token_expires_at: tokenExpiresAt,
    permalink_seller: permalinkSeller,
  })
})
