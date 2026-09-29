// Hook acionado imediatamente após a criação de um registro em magalu_oauth_requests
// Troca o authorization_code por tokens no ID Magalu (OAuth 2.0) e salva em magalu_settings
// Tudo inline dentro do callback para respeitar a VM isolada do PocketBase

onRecordAfterCreateSuccess((e) => {
  const req = e.record
  if (!req || req.getString('status') !== 'pending') {
    e.next()
    return
  }

  const code = req.getString('code')
  const customRedirectUri = req.getString('redirect_uri')

  let settings = null
  try {
    const sRecords = $app.findRecordsByFilter('magalu_settings', '1=1', '-created', 1, 0)
    if (sRecords && sRecords.length > 0) {
      settings = sRecords[0]
    }
  } catch (err) {
    console.log('[magalu_oauth_hook] Erro ao carregar magalu_settings: ' + err)
  }

  if (!settings) {
    req.set('status', 'error')
    req.set(
      'error_message',
      'Configurações do Magalu não encontradas. Cadastre o Client ID e Client Secret em Configurações > Magalu.',
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
    req.set('error_message', 'Client ID ou Client Secret do Magalu não configurados.')
    $app.save(req)
    e.next()
    return
  }

  let tokenRes = null
  try {
    tokenRes = $http.send({
      url: 'https://id.magalu.com/oauth/token',
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
      'Falha de rede ao conectar à API do ID Magalu: ' + (netErr.message || netErr),
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
      'Falha na autenticação OAuth do Magalu (status ' + tokenRes.statusCode + ').'
    req.set('status', 'error')
    req.set('error_message', errorDesc)
    $app.save(req)
    e.next()
    return
  }

  const tokenData = tokenRes.json || {}
  const accessToken = tokenData.access_token || ''
  const refreshToken = tokenData.refresh_token || ''
  const expiresIn = Number(tokenData.expires_in) || 7200
  const returnedScope = tokenData.scope || ''

  console.log('[magalu_oauth_hook] Token obtido com sucesso! Escopos: ' + returnedScope)

  if (!accessToken) {
    req.set('status', 'error')
    req.set('error_message', 'Magalu não retornou access_token válido.')
    $app.save(req)
    e.next()
    return
  }

  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

  // Tenta extrair tenant / seller id do token JWT ou consulta de perfil
  let sellerId = ''
  let sellerName = ''
  try {
    // JWT decoding payload (segundo pedaço do token)
    const parts = accessToken.split('.')
    if (parts.length >= 2) {
      // Base64 decode simples se possível
      // No PocketBase v0.36 o helper $security.parseJWT ou payload decode pode ser feito
      const rawPayload = parts[1]
      // normaliza padding
      let pad = rawPayload.length % 4
      let b64 = rawPayload.replace(/-/g, '+').replace(/_/g, '/')
      if (pad) {
        b64 += '='.repeat(4 - pad)
      }
      // Se tiver tenant_id nas claims
      const claimsStr = $security.base64Decode(b64)
      if (claimsStr) {
        const claims = JSON.parse(claimsStr)
        if (claims.tenant_id) sellerId = String(claims.tenant_id)
        if (claims.organization_id && !sellerId) sellerId = String(claims.organization_id)
        if (claims.client_id && !sellerId) sellerId = String(claims.client_id)
        if (claims.name) sellerName = String(claims.name)
        if (claims.sub && !sellerName) sellerName = String(claims.sub)
      }
    }
  } catch (jwtErr) {
    console.log('[magalu_oauth_hook] Aviso ao ler payload do JWT Magalu: ' + jwtErr)
  }

  settings.set('access_token', accessToken)
  settings.set('refresh_token', refreshToken)
  settings.set('token_expires_at', expiresAt)
  if (returnedScope) settings.set('scopes', returnedScope)
  if (sellerId) settings.set('seller_id', sellerId)
  if (sellerName) settings.set('seller_name', sellerName)
  if (redirectUri && !settings.getString('redirect_uri')) {
    settings.set('redirect_uri', redirectUri)
  }
  $app.save(settings)

  req.set('status', 'done')
  req.set('error_message', '')
  $app.save(req)
  console.log(
    '[magalu_oauth_hook] OAuth finalizado com sucesso para Magalu Seller: ' +
      (sellerName || sellerId),
  )

  e.next()
}, 'magalu_oauth_requests')
