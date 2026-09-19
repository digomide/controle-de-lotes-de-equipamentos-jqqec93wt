// Hook acionado imediatamente após a criação de um registro em ml_oauth_requests
// Troca o authorization_code por tokens no Mercado Livre e salva em ml_settings
// Tudo inline dentro do callback para respeitar a VM isolada do PocketBase

onRecordAfterCreateSuccess((e) => {
  const req = e.record
  if (!req || req.getString('status') !== 'pending') {
    e.next()
    return
  }

  const code = req.getString('code')
  const customRedirectUri = req.getString('redirect_uri')
  const reqTenantId = req.getString('tenant_id') || ''

  let settings = null
  try {
    if (reqTenantId) {
      const sRecords = $app.findRecordsByFilter(
        'ml_settings',
        'tenant_id = {:tid}',
        '-created',
        1,
        0,
        { tid: reqTenantId },
      )
      if (sRecords && sRecords.length > 0) {
        settings = sRecords[0]
      }
    }
  } catch (err) {
    console.log(
      '[ml_oauth_hook] Erro ao carregar ml_settings para tenant ' + reqTenantId + ': ' + err,
    )
  }

  if (!settings) {
    req.set('status', 'error')
    req.set(
      'error_message',
      'Configurações do Mercado Livre não encontradas para o tenant ativo. Cadastre o App ID e Client Secret nas configurações.',
    )
    $app.save(req)
    e.next()
    return
  }

  const clientId = settings.getString('client_id')
  const clientSecret = settings.getString('client_secret')
  const redirectUri = customRedirectUri || settings.getString('redirect_uri')

  if (!clientId || !clientSecret) {
    req.set('status', 'error')
    req.set('error_message', 'Client ID ou Client Secret do Mercado Livre não configurados.')
    $app.save(req)
    e.next()
    return
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
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: redirectUri,
      }),
      timeout: 30,
    })
  } catch (netErr) {
    req.set('status', 'error')
    req.set(
      'error_message',
      'Falha de rede ao conectar à API do Mercado Livre: ' + (netErr.message || netErr),
    )
    $app.save(req)
    e.next()
    return
  }

  if (tokenRes.statusCode >= 400) {
    const errJson = tokenRes.json || {}
    const errorDesc =
      errJson.error_description ||
      errJson.message ||
      errJson.error ||
      'Falha na autenticação OAuth do Mercado Livre (status ' + tokenRes.statusCode + ').'
    req.set('status', 'error')
    req.set('error_message', errorDesc)
    $app.save(req)
    e.next()
    return
  }

  const tokenData = tokenRes.json || {}
  const accessToken = tokenData.access_token || ''
  const refreshToken = tokenData.refresh_token || ''
  const expiresIn = Number(tokenData.expires_in) || 21600
  const userId = (tokenData.user_id || '').toString()

  if (!accessToken) {
    req.set('status', 'error')
    req.set('error_message', 'Mercado Livre não retornou access_token válido.')
    $app.save(req)
    e.next()
    return
  }

  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

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
    console.log('[ml_oauth_hook] Erro ao buscar dados do perfil do ML: ' + uErr)
  }

  settings.set('access_token', accessToken)
  settings.set('refresh_token', refreshToken)
  settings.set('token_expires_at', expiresAt)
  settings.set('user_id_ml', userId)
  settings.set('nickname', nickname)
  settings.set('permalink_seller', permalink)
  if (redirectUri && !settings.getString('redirect_uri')) {
    settings.set('redirect_uri', redirectUri)
  }
  if (reqTenantId && !settings.getString('tenant_id')) {
    settings.set('tenant_id', reqTenantId)
  }
  $app.save(settings)

  req.set('status', 'done')
  req.set('error_message', '')
  $app.save(req)
  console.log('[ml_oauth_hook] OAuth finalizado com sucesso para vendedor: ' + nickname)

  e.next()
}, 'ml_oauth_requests')
