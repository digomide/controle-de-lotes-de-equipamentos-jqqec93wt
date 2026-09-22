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

  // Determinar tenant solicitado ou autenticado
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

  let tenantId = ''
  if (isSuperAdmin && reqTenant) {
    tenantId = reqTenant.trim()
  } else if (userTenant) {
    tenantId = userTenant.trim()
  } else if (reqTenant) {
    tenantId = reqTenant.trim()
  }

  const canonicalProductionRedirectUri =
    'https://controle-de-lotes-de-equipamentos-25024.goskip.app/configuracoes'

  // Buscar registro ml_settings por ID ou slug do tenant
  let settings = null
  if (tenantId) {
    try {
      // 1. Tentar busca direta por ID ou slug em ml_settings
      const sRecords = $app.findRecordsByFilter(
        'ml_settings',
        'tenant_id = {:tid} || tenant_id = {:tslug}',
        '-created',
        1,
        0,
        { tid: tenantId, tslug: tenantId },
      )
      if (sRecords && sRecords.length > 0) {
        settings = sRecords[0]
      } else {
        // 2. Se o identificador informado for ID ou slug de um tenant, resolver correspondente
        const tRecords = $app.findRecordsByFilter(
          'tenants',
          'id = {:tval} || slug = {:tval}',
          '-created',
          1,
          0,
          { tval: tenantId },
        )
        if (tRecords && tRecords.length > 0) {
          const resolvedTenantId = tRecords[0].id
          const resolvedSlug = tRecords[0].getString('slug')
          if (resolvedTenantId !== tenantId || resolvedSlug !== tenantId) {
            const matched = $app.findRecordsByFilter(
              'ml_settings',
              'tenant_id = {:tid} || tenant_id = {:tslug}',
              '-created',
              1,
              0,
              { tid: resolvedTenantId, tslug: resolvedSlug },
            )
            if (matched && matched.length > 0) {
              settings = matched[0]
            }
          }
        }
      }
    } catch (err) {
      console.log(
        '[ml_status_hook] Erro ao carregar ml_settings para tenant ' + tenantId + ': ' + err,
      )
    }
  }

  // Quando não houver registro, retornar estritamente o JSON neutro sem herdar propriedades do mestre
  if (!settings) {
    return e.json(200, {
      ok: true,
      configured: false,
      connected: false,
      client_id: '',
      client_secret_configured: false,
      redirect_uri: canonicalProductionRedirectUri,
      user_id_ml: null,
      nickname: null,
      permalink_seller: null,
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

  let tenantId = ''
  if (isSuperAdmin && reqTenant) {
    tenantId = reqTenant.trim()
  } else if (userTenant) {
    tenantId = userTenant.trim()
  } else if (reqTenant) {
    tenantId = reqTenant.trim()
  }

  const canonicalProductionRedirectUri =
    'https://controle-de-lotes-de-equipamentos-25024.goskip.app/configuracoes'

  let settings = null
  if (tenantId) {
    try {
      const sRecords = $app.findRecordsByFilter(
        'ml_settings',
        'tenant_id = {:tid} || tenant_id = {:tslug}',
        '-created',
        1,
        0,
        { tid: tenantId, tslug: tenantId },
      )
      if (sRecords && sRecords.length > 0) {
        settings = sRecords[0]
      } else {
        const tRecords = $app.findRecordsByFilter(
          'tenants',
          'id = {:tval} || slug = {:tval}',
          '-created',
          1,
          0,
          { tval: tenantId },
        )
        if (tRecords && tRecords.length > 0) {
          const resolvedTenantId = tRecords[0].id
          const resolvedSlug = tRecords[0].getString('slug')
          if (resolvedTenantId !== tenantId || resolvedSlug !== tenantId) {
            const matched = $app.findRecordsByFilter(
              'ml_settings',
              'tenant_id = {:tid} || tenant_id = {:tslug}',
              '-created',
              1,
              0,
              { tid: resolvedTenantId, tslug: resolvedSlug },
            )
            if (matched && matched.length > 0) {
              settings = matched[0]
            }
          }
        }
      }
    } catch (err) {
      console.log(
        '[ml_status_hook] Erro ao carregar ml_settings para tenant ' + tenantId + ': ' + err,
      )
    }
  }

  if (!settings) {
    return e.json(200, {
      ok: true,
      configured: false,
      connected: false,
      client_id: '',
      client_secret_configured: false,
      redirect_uri: canonicalProductionRedirectUri,
      user_id_ml: null,
      nickname: null,
      permalink_seller: null,
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
})
