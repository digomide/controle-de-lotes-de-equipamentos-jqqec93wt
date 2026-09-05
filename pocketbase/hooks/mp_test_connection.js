// Endpoint para verificar conexão com as credenciais do Mercado Pago
// Route: POST /api/store/mp/test-connection
// Auth: Requer autenticação (painel administrativo)

routerAdd(
  'POST',
  '/api/store/mp/test-connection',
  (e) => {
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
      const res = $http.send({
        url: 'https://api.mercadopago.com/users/me',
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + accessToken,
          Accept: 'application/json',
        },
        timeout: 15,
      })

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
        const errMessage = errJson.message || 'Código HTTP ' + res.statusCode
        return e.json(200, {
          ok: false,
          configured: true,
          message: 'Mercado Pago rejeitou o Access Token: ' + errMessage,
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
  },
  $apis.requireAuth(),
)
