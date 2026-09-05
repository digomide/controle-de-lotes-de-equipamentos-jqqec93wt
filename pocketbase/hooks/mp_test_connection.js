// Endpoint para verificar conexão com as credenciais do Mercado Pago
// Route: POST /api/store/mp/test-connection
// Auth: Requer autenticação (painel administrativo)

console.log('[mp_test_connection] Carregando arquivo do hook mp_test_connection.js')

routerAdd('POST', '/api/store/mp/test-connection', (e) => {
  let authRecord = e.auth
  if (!authRecord) {
    try {
      const info = e.requestInfo()
      authRecord = info.auth
    } catch (_) {}
  }
  if (!authRecord) {
    return e.json(401, {
      code: 401,
      message: 'The request requires valid administrator authorization token.',
      data: {},
    })
  }
  console.log('[mp_test_connection] Rota acionada!')
  let body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (_) {
    body = {}
  }

  let accessToken = (body.mp_access_token || '').trim()

  // Se não veio no body, busca nas configurações salvas
  if (!accessToken) {
    try {
      const settings = $app.findRecordsByFilter('mercadopago_settings', '1=1', '-created', 1, 0)
      if (settings && settings.length > 0) {
        accessToken = settings[0].getString('mp_access_token')
      }
    } catch (err) {
      console.log('[mp_test] Erro ao buscar mercadopago_settings: ' + err)
    }
  }

  if (!accessToken) {
    return e.json(200, {
      ok: false,
      configured: false,
      message: 'Nenhum Access Token do Mercado Pago fornecido ou configurado.',
    })
  }

  try {
    // 1ª tentativa: endpoint oficial do Mercado Pago /users/me
    let res = $http.send({
      url: 'https://api.mercadopago.com/users/me',
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + accessToken,
        Accept: 'application/json',
      },
      timeout: 15,
    })

    // Se retornar 404 em api.mercadopago.com, tenta no host unificado da plataforma api.mercadolibre.com/users/me
    if (res.statusCode === 404) {
      try {
        const resFallback = $http.send({
          url: 'https://api.mercadolibre.com/users/me',
          method: 'GET',
          headers: {
            Authorization: 'Bearer ' + accessToken,
            Accept: 'application/json',
          },
          timeout: 15,
        })
        if (resFallback.statusCode === 200) {
          res = resFallback
        }
      } catch (_) {}
    }

    if (res.statusCode === 200 && res.json) {
      const userData = res.json
      return e.json(200, {
        ok: true,
        configured: true,
        message: 'Conexão com Mercado Pago validada com sucesso!',
        data: {
          id: userData.id,
          nickname: userData.nickname || '',
          first_name: userData.first_name || '',
          last_name: userData.last_name || '',
          email: userData.email || '',
          site_id: userData.site_id || '',
          user_type: userData.user_type || '',
          points: userData.points || 0,
        },
      })
    } else {
      const errJson = res.json || {}
      let rawMessage = errJson.message || ''

      // Interpretação e tradução amigável dos erros comuns da API do Mercado Pago
      let userFriendlyMessage = ''
      if (res.statusCode === 401 || res.statusCode === 403) {
        userFriendlyMessage =
          'Access Token inválido ou sem permissão. Verifique se você copiou o token completo de Produção (APP_USR-...).'
      } else if (res.statusCode === 404 || rawMessage.toLowerCase().indexOf('not found') >= 0) {
        userFriendlyMessage =
          'Token não reconhecido ou aplicação não ativada no Mercado Pago. Confirme no Painel de Desenvolvedores se você clicou em "Ativar credenciais de produção" e copiou o Access Token correto da aplicação "Loja Infoprecobaixo".'
      } else if (rawMessage) {
        userFriendlyMessage =
          'Mercado Pago retornou: ' + rawMessage + ' (HTTP ' + res.statusCode + ')'
      } else {
        userFriendlyMessage = 'Código HTTP retornado pelo Mercado Pago: ' + res.statusCode
      }

      return e.json(200, {
        ok: false,
        configured: true,
        raw_message: rawMessage,
        message: userFriendlyMessage,
        status_code: res.statusCode,
      })
    }
  } catch (httpErr) {
    return e.json(200, {
      ok: false,
      configured: true,
      message:
        'Falha de comunicação de rede com a API do Mercado Pago: ' + (httpErr.message || httpErr),
    })
  }
})
