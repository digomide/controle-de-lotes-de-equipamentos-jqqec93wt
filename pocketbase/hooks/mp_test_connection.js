// Hook acionado imediatamente após a criação de um registro em mp_test_jobs
// Executa a validação real do token diretamente contra a API oficial do Mercado Pago
// Seguindo EXATAMENTE o mesmo padrão robusto de ml_oauth_requests / ml_publish_queue
// Tudo inline dentro do callback para respeitar a VM isolada do PocketBase v0.36 (Goja engine)

onRecordAfterCreateSuccess((e) => {
  const job = e.record
  if (!job || job.getString('status') !== 'pending') {
    e.next()
    return
  }

  job.set('status', 'processing')
  $app.save(job)

  let accessToken = (job.getString('token_override') || '').trim()

  // Se não foi enviado token_override no job, busca nas configurações salvas do Mercado Pago
  if (!accessToken) {
    try {
      const settings = $app.findRecordsByFilter('mercadopago_settings', '1=1', '-created', 1, 0)
      if (settings && settings.length > 0) {
        accessToken = (settings[0].getString('mp_access_token') || '').trim()
      }
    } catch (err) {
      console.log('[mp_test_job] Erro ao buscar mercadopago_settings: ' + err)
    }
  }

  if (!accessToken) {
    job.set('status', 'error')
    job.set('message', 'Nenhum Access Token do Mercado Pago fornecido ou configurado.')
    job.set('raw_message', 'missing_access_token')
    job.set('status_code', 400)
    $app.save(job)
    e.next()
    return
  }

  console.log(
    '[mp_test_job] Testando token no Mercado Pago (início: ' +
      accessToken.substring(0, 10) +
      '...)',
  )

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

    console.log('[mp_test_job] Resposta da API MP: status ' + res.statusCode)

    if (res.statusCode === 200 && res.json) {
      const userData = res.json
      job.set('status', 'done')
      job.set('status_code', 200)
      job.set('message', 'Conexão com Mercado Pago validada com sucesso!')
      job.set('raw_message', '')
      job.set('user_data', {
        id: userData.id,
        nickname: userData.nickname || '',
        first_name: userData.first_name || '',
        last_name: userData.last_name || '',
        email: userData.email || '',
        site_id: userData.site_id || 'MLB',
        user_type: userData.user_type || '',
        points: userData.points || 0,
      })
      $app.save(job)
      console.log(
        '[mp_test_job] Token validado com sucesso para usuário: ' +
          (userData.nickname || userData.id),
      )
    } else {
      const errJson = res.json || {}
      let rawMessage = errJson.message || errJson.error || ''

      // Interpretação e tradução amigável dos erros comuns da API do Mercado Pago
      let userFriendlyMessage = ''
      if (res.statusCode === 401 || res.statusCode === 403) {
        userFriendlyMessage =
          'Access Token inválido ou sem permissão. Verifique se você copiou o token completo de Produção (APP_USR-...).'
      } else if (
        res.statusCode === 404 ||
        (rawMessage && rawMessage.toLowerCase().indexOf('not found') >= 0)
      ) {
        userFriendlyMessage =
          'Token não reconhecido ou aplicação não ativada no Mercado Pago. Confirme no Painel de Desenvolvedores se você clicou em "Ativar credenciais de produção" e copiou o Access Token correto da aplicação.'
      } else if (rawMessage) {
        userFriendlyMessage =
          'Mercado Pago retornou: ' + rawMessage + ' (HTTP ' + res.statusCode + ')'
      } else {
        userFriendlyMessage = 'Código HTTP retornado pelo Mercado Pago: ' + res.statusCode
      }

      job.set('status', 'error')
      job.set('status_code', res.statusCode)
      job.set('message', userFriendlyMessage)
      job.set('raw_message', rawMessage)
      $app.save(job)
      console.log('[mp_test_job] Erro retornado pelo MP: ' + userFriendlyMessage)
    }
  } catch (httpErr) {
    const errText = httpErr.message || String(httpErr)
    console.log('[mp_test_job] Falha de comunicação com MP: ' + errText)
    job.set('status', 'error')
    job.set('status_code', 500)
    job.set('message', 'Falha de comunicação de rede com a API do Mercado Pago: ' + errText)
    job.set('raw_message', errText)
    $app.save(job)
  }

  e.next()
}, 'mp_test_jobs')

// Mantém também rota routerAdd caso no futuro o Skip Cloud habilite routerAdd no boot
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
    })
  }

  let body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (_) {
    body = {}
  }

  let accessToken = (body.mp_access_token || '').trim()
  if (!accessToken) {
    try {
      const settings = $app.findRecordsByFilter('mercadopago_settings', '1=1', '-created', 1, 0)
      if (settings && settings.length > 0) {
        accessToken = settings[0].getString('mp_access_token')
      }
    } catch (_) {}
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
        },
      })
    } else {
      return e.json(200, {
        ok: false,
        configured: true,
        message: 'Código retornado pelo MP: ' + res.statusCode,
        status_code: res.statusCode,
      })
    }
  } catch (err) {
    return e.json(200, {
      ok: false,
      configured: true,
      message: 'Erro: ' + (err.message || err),
    })
  }
})
