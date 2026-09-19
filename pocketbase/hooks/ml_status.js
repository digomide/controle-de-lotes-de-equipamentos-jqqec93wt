// Hook para consulta de status e configuração sanitizada do Mercado Livre
// Rota segura sob namespace /backend/v1/ml/status e /ml/status
// Lê internamente ml_settings sem expor secrets (access_token, refresh_token, client_secret)

function getEffectiveTenantId(e, authRecord) {
  let reqTenant = ''
  try {
    if (e.request) {
      reqTenant = e.request.header.get('x-tenant-id') || ''
      if (!reqTenant && e.request.url) {
        reqTenant = e.request.url.query().get('tenant_id') || ''
      }
    }
  } catch (_) {}

  const role = authRecord ? authRecord.getString('role') : ''
  const isSuperAdmin = role === 'super_admin'
  const userTenant = authRecord ? authRecord.getString('tenant_id') : ''

  // Super-admin pode impersonar qualquer tenant informado pelo header ou query
  if (isSuperAdmin && reqTenant) {
    return reqTenant.trim()
  }
  // Admin ou usuário comum usa o tenant informado se bater ou o seu próprio tenant_id
  if (userTenant) {
    return userTenant.trim()
  }
  if (reqTenant) {
    return reqTenant.trim()
  }
  return ''
}

function resolveSettingsForTenant(appInstance, tenantId) {
  if (!tenantId) {
    // Isolamento estrito bilateral: SEM fallback para o tenant mestre
    return null
  }
  try {
    const sRecords = appInstance.findRecordsByFilter(
      'ml_settings',
      'tenant_id = {:tid}',
      '-created',
      1,
      0,
      { tid: tenantId },
    )
    if (sRecords && sRecords.length > 0) {
      return sRecords[0]
    }
  } catch (err) {
    console.log(
      '[ml_status_hook] Erro ao carregar ml_settings para tenant ' + tenantId + ': ' + err,
    )
  }
  return null
}

function handleMLStatus(e) {
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

  const tenantId = getEffectiveTenantId(e, authRecord)
  const canonicalProductionRedirectUri =
    'https://controle-de-lotes-de-equipamentos-25024.goskip.app/configuracoes'

  const settings = resolveSettingsForTenant($app, tenantId)

  if (!settings) {
    return e.json(200, {
      ok: true,
      configured: false,
      connected: false,
      client_id: '',
      client_secret_configured: false,
      redirect_uri: canonicalProductionRedirectUri,
      user_id_ml: '',
      nickname: '',
      permalink_seller: '',
      token_expires_at: null,
      site_id: 'MLB',
      tenant_id: tenantId,
      status: 'disconnected',
    })
  }

  const clientId = settings.getString('client_id')
  const clientSecret = settings.getString('client_secret')
  const accessToken = settings.getString('access_token')
  const userIdMl = settings.getString('user_id_ml')
  const nickname = settings.getString('nickname')
  const permalinkSeller = settings.getString('permalink_seller')
  const tokenExpiresAt = settings.getString('token_expires_at')
  const siteId = settings.getString('site_id') || 'MLB'

  let redirectUri = settings.getString('redirect_uri')
  if (!redirectUri || redirectUri.includes('localhost') || redirectUri.includes('127.0.0.1')) {
    redirectUri = canonicalProductionRedirectUri
  }

  const configured = !!(clientId && clientSecret)
  const connected = !!(accessToken && userIdMl)

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
    user_id_ml: userIdMl,
    nickname,
    permalink_seller: permalinkSeller,
    token_expires_at: tokenExpiresAt || null,
    site_id: siteId,
    tenant_id: settings.getString('tenant_id') || tenantId,
    status,
  })
}

routerAdd('GET', '/backend/v1/ml/status', (e) => {
  return handleMLStatus(e)
})

routerAdd('GET', '/ml/status', (e) => {
  return handleMLStatus(e)
})
