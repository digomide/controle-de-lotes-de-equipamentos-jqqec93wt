migrate(
  (app) => {
    // 0064_verify_mp_job_trigger.js
    // Testa o fluxo de criação de job com o token real gravado em mercadopago_settings
    // para confirmar que a API do Mercado Pago responde e o hook preenche os campos.
    const settings = app.findRecordsByFilter('mercadopago_settings', '1=1', '-created', 1, 0)
    let token = ''
    if (settings && settings.length > 0) {
      token = settings[0].getString('mp_access_token')
    }

    if (!token) {
      console.log('[0064_verify] Nenhum token em mercadopago_settings para testar.')
      return
    }

    console.log(
      '[0064_verify] Testando chamada à API do Mercado Pago diretamente com token gravado...',
    )
    const res = $http.send({
      url: 'https://api.mercadopago.com/users/me',
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/json',
      },
      timeout: 15,
    })

    console.log(
      '[0064_verify] Resposta HTTP Mercado Pago: status=' + res.statusCode + ' body=' + res.raw,
    )

    // Se respondeu, cria um registro de teste na coleção mp_test_jobs para conferir gravação
    const col = app.findCollectionByNameOrId('mp_test_jobs')
    const rec = new Record(col)
    rec.set('token_override', token)
    if (res.statusCode === 200 && res.json) {
      rec.set('status', 'done')
      rec.set('status_code', 200)
      rec.set('message', 'Conexão com Mercado Pago validada com sucesso!')
      rec.set('user_data', res.json)
    } else {
      rec.set('status', 'error')
      rec.set('status_code', res.statusCode)
      rec.set('message', 'Código HTTP retornado pelo Mercado Pago: ' + res.statusCode)
      rec.set('raw_message', res.raw)
    }
    app.save(rec)
    console.log('[0064_verify] Registro salvo em mp_test_jobs id=' + rec.id)
  },
  (app) => {},
)
