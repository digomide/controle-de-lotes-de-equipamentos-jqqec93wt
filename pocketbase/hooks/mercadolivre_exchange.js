// Rota POST /api/ml/oauth/exchange - Troca authorization_code por access_token e refresh_token
// Busca dados do usuário (GET /users/me) para pegar nickname e permalink

routerAdd(
  'POST',
  '/api/ml/oauth/exchange',
  (e) => {
    const body = e.requestInfo().body || {}
    const code = (body.code || '').toString().trim()
    const customRedirectUri = (body.redirect_uri || '').toString().trim()

    if (!code) {
      return e.json(400, { error: 'Código de autorização não informado.' })
    }

    let settings = null
    try {
      const records = $app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
      if (records && records.length > 0) {
        settings = records[0]
      }
    } catch (_) {}

    if (!settings) {
      return e.json(400, { error: 'Configurações do Mercado Livre não encontradas no sistema.' })
    }

    const clientId = settings.getString('client_id')
    const clientSecret = settings.getString('client_secret')
    const redirectUri = customRedirectUri || settings.getString('redirect_uri')

    if (!clientId || !clientSecret) {
      return e.json(400, { error: 'Client ID ou Client Secret do Mercado Livre não configurados.' })
    }

    // Chamada POST para https://api.mercadolibre.com/oauth/token
    const payload = {
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      redirect_uri: redirectUri,
    }

    let tokenRes = null
    try {
      tokenRes = $http.send({
        url: 'https://api.mercadolibre.com/oauth/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
        timeout: 30,
      })
    } catch (netErr) {
      return e.json(502, {
        error: 'Erro de comunicação ao contactar a API do Mercado Livre: ' + netErr,
      })
    }

    if (tokenRes.statusCode >= 400) {
      const errorData = tokenRes.json || {}
      return e.json(tokenRes.statusCode, {
        error:
          errorData.message ||
          errorData.error_description ||
          errorData.error ||
          'Falha na autenticação com o Mercado Livre.',
        raw: errorData,
      })
    }

    const tokenData = tokenRes.json || {}
    const accessToken = tokenData.access_token || ''
    const refreshToken = tokenData.refresh_token || ''
    const expiresIn = Number(tokenData.expires_in) || 21600
    const userId = (tokenData.user_id || '').toString()

    if (!accessToken) {
      return e.json(500, { error: 'Mercado Livre não retornou access_token válido.' })
    }

    // Calcular data de expiração (agora + expiresIn segundos)
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

    // Obter dados do usuário no Mercado Livre (nickname, permalink)
    let nickname = ''
    let permalink = ''
    try {
      const userRes = $http.send({
        url: 'https://api.mercadolibre.com/users/me',
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + accessToken,
        },
        timeout: 15,
      })
      if (userRes.statusCode === 200 && userRes.json) {
        nickname = userRes.json.nickname || ''
        permalink = userRes.json.permalink || ''
      }
    } catch (uErr) {
      console.log('Error fetching user info from ML: ' + uErr)
    }

    // Salvar tokens e perfil na coleção ml_settings
    settings.set('access_token', accessToken)
    settings.set('refresh_token', refreshToken)
    settings.set('token_expires_at', expiresAt)
    settings.set('user_id_ml', userId)
    settings.set('nickname', nickname)
    settings.set('permalink_seller', permalink)
    if (redirectUri && !settings.getString('redirect_uri')) {
      settings.set('redirect_uri', redirectUri)
    }
    $app.save(settings)

    return e.json(200, {
      success: true,
      nickname: nickname,
      user_id_ml: userId,
      permalink_seller: permalink,
    })
  },
  $apis.requireAuth(),
)
