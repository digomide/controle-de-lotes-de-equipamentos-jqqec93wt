// Rota POST /api/ml/config - Salva ou atualiza Client ID, Client Secret e Redirect URI
// Rota GET /api/ml/status - Retorna status da conexão ML (sem expor client_secret ou tokens)
// Rota POST /api/ml/disconnect - Limpa os tokens e desvincula a conta

routerAdd(
  'GET',
  '/api/ml/status',
  (e) => {
    let settings = null
    try {
      const records = $app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
      if (records && records.length > 0) {
        settings = records[0]
      }
    } catch (err) {
      // no settings yet
    }

    if (!settings) {
      return e.json(200, {
        configured: false,
        connected: false,
        client_id: '',
        redirect_uri: '',
        nickname: '',
        user_id_ml: '',
        permalink_seller: '',
      })
    }

    const clientId = settings.getString('client_id')
    const accessToken = settings.getString('access_token')
    const nickname = settings.getString('nickname')
    const userIdMl = settings.getString('user_id_ml')
    const redirectUri = settings.getString('redirect_uri')
    const permalink = settings.getString('permalink_seller')

    return e.json(200, {
      configured: Boolean(clientId && clientId.trim().length > 0),
      connected: Boolean(accessToken && accessToken.trim().length > 0),
      client_id: clientId || '',
      redirect_uri: redirectUri || '',
      nickname: nickname || '',
      user_id_ml: userIdMl || '',
      permalink_seller: permalink || '',
    })
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/api/ml/config',
  (e) => {
    const body = e.requestInfo().body || {}
    const clientId = (body.client_id || '').toString().trim()
    const clientSecret = (body.client_secret || '').toString().trim()
    const redirectUri = (body.redirect_uri || '').toString().trim()

    let record = null
    try {
      const records = $app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
      if (records && records.length > 0) {
        record = records[0]
      }
    } catch (_) {}

    if (!record) {
      const col = $app.findCollectionByNameOrId('ml_settings')
      record = new Record(col)
    }

    record.set('client_id', clientId)
    if (clientSecret) {
      record.set('client_secret', clientSecret)
    }
    record.set('redirect_uri', redirectUri)

    $app.save(record)

    return e.json(200, {
      success: true,
      configured: Boolean(clientId),
      client_id: clientId,
      redirect_uri: redirectUri,
    })
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/api/ml/disconnect',
  (e) => {
    try {
      const records = $app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
      if (records && records.length > 0) {
        const record = records[0]
        record.set('access_token', '')
        record.set('refresh_token', '')
        record.set('token_expires_at', null)
        record.set('nickname', '')
        record.set('user_id_ml', '')
        record.set('permalink_seller', '')
        $app.save(record)
      }
    } catch (err) {
      console.log('Error disconnecting ML: ' + err)
    }

    return e.json(200, { success: true, connected: false })
  },
  $apis.requireAuth(),
)
