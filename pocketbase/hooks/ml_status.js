// Hook para consulta de status e configuração sanitizada do Mercado Livre
// Rota segura acessível a qualquer usuário autenticado (@request.auth.id != '')
// Lê internamente ml_settings sem expor secrets (access_token, refresh_token, client_secret)
// Nota: lógica 100% inline dentro de cada callback para compatibilidade estrita com a JSVM do PocketBase

// 1. Rota canônica sob namespace da API interna /backend/v1/ml/status
routerAdd(
  'GET',
  '/backend/v1/ml/status',
  (e) => {
    var authRecord = e.auth
    if (!authRecord) {
      try {
        var info = e.requestInfo()
        authRecord = info.auth
      } catch (_) {}
    }

    if (!authRecord || !authRecord.id) {
      return e.json(401, {
        ok: false,
        error: 'Acesso não autorizado: sessão expirada ou não autenticada.',
      })
    }

    var settings = null
    try {
      var sRecords = $app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
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
        redirect_uri: '',
        redirect_uri_is_production: false,
        nickname: '',
        user_id_ml: '',
        token_expires_at: null,
        permalink_seller: '',
      })
    }

    var clientId = (settings.getString('client_id') || '').trim()
    var clientSecret = (settings.getString('client_secret') || '').trim()
    var accessToken = (settings.getString('access_token') || '').trim()
    var redirectUri = (settings.getString('redirect_uri') || '').trim()
    var nickname = (settings.getString('nickname') || '').trim()
    var userIdMl = (settings.getString('user_id_ml') || '').trim()
    var tokenExpiresAt = settings.getString('token_expires_at') || null
    var permalinkSeller = (settings.getString('permalink_seller') || '').trim()

    var isConnected = Boolean(accessToken && clientId)
    var isConfigured = Boolean(clientId)
    var clientSecretConfigured = Boolean(clientSecret)
    var redirectUriIsProduction = Boolean(redirectUri && !redirectUri.includes('--preview'))

    return e.json(200, {
      ok: true,
      configured: isConfigured,
      connected: isConnected,
      client_id: clientId,
      client_secret_configured: clientSecretConfigured,
      redirect_uri: redirectUri,
      redirect_uri_is_production: redirectUriIsProduction,
      nickname: nickname,
      user_id_ml: userIdMl,
      token_expires_at: tokenExpiresAt,
      permalink_seller: permalinkSeller,
    })
  },
  $apis.requireAuth(),
)

// 2. Rota amigável /ml/status
routerAdd(
  'GET',
  '/ml/status',
  (e) => {
    var authRecord = e.auth
    if (!authRecord) {
      try {
        var info = e.requestInfo()
        authRecord = info.auth
      } catch (_) {}
    }

    if (!authRecord || !authRecord.id) {
      return e.json(401, {
        ok: false,
        error: 'Acesso não autorizado: sessão expirada ou não autenticada.',
      })
    }

    var settings = null
    try {
      var sRecords = $app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
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
        redirect_uri: '',
        redirect_uri_is_production: false,
        nickname: '',
        user_id_ml: '',
        token_expires_at: null,
        permalink_seller: '',
      })
    }

    var clientId = (settings.getString('client_id') || '').trim()
    var clientSecret = (settings.getString('client_secret') || '').trim()
    var accessToken = (settings.getString('access_token') || '').trim()
    var redirectUri = (settings.getString('redirect_uri') || '').trim()
    var nickname = (settings.getString('nickname') || '').trim()
    var userIdMl = (settings.getString('user_id_ml') || '').trim()
    var tokenExpiresAt = settings.getString('token_expires_at') || null
    var permalinkSeller = (settings.getString('permalink_seller') || '').trim()

    var isConnected = Boolean(accessToken && clientId)
    var isConfigured = Boolean(clientId)
    var clientSecretConfigured = Boolean(clientSecret)
    var redirectUriIsProduction = Boolean(redirectUri && !redirectUri.includes('--preview'))

    return e.json(200, {
      ok: true,
      configured: isConfigured,
      connected: isConnected,
      client_id: clientId,
      client_secret_configured: clientSecretConfigured,
      redirect_uri: redirectUri,
      redirect_uri_is_production: redirectUriIsProduction,
      nickname: nickname,
      user_id_ml: userIdMl,
      token_expires_at: tokenExpiresAt,
      permalink_seller: permalinkSeller,
    })
  },
  $apis.requireAuth(),
)
