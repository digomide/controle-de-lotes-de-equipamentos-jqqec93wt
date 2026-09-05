// Endpoint para testar conexão com a Meta (WhatsApp Cloud API / Instagram Graph API)
// Route: POST /api/marketing/test-connection
// Auth: Superuser ou usuário autenticado

routerAdd(
  'POST',
  '/api/marketing/test-connection',
  (e) => {
    let body = {}
    try {
      body = e.requestInfo().body || {}
    } catch (_) {
      body = {}
    }

    // Carregar credenciais passadas no body ou registradas em marketing_settings
    let metaWaToken = (body.meta_wa_token || '').trim()
    let metaWaPhoneId = (body.meta_wa_phone_number_id || '').trim()
    let instagramToken = (body.instagram_token || '').trim()
    let instagramUserId = (body.instagram_user_id || '').trim()

    if (!metaWaToken || !metaWaPhoneId || !instagramToken) {
      try {
        const sRecords = $app.findRecordsByFilter('marketing_settings', '1=1', '-created', 1, 0)
        if (sRecords && sRecords.length > 0) {
          const s = sRecords[0]
          if (!metaWaToken) metaWaToken = s.getString('meta_wa_token')
          if (!metaWaPhoneId) metaWaPhoneId = s.getString('meta_wa_phone_number_id')
          if (!instagramToken) instagramToken = s.getString('instagram_token')
          if (!instagramUserId) instagramUserId = s.getString('instagram_user_id')
        }
      } catch (sErr) {
        console.log('[marketing_test] Erro ao buscar marketing_settings: ' + sErr)
      }
    }

    const result = {
      whatsapp: {
        configured: Boolean(metaWaToken && metaWaPhoneId),
        ok: false,
        message: '',
        data: null,
      },
      instagram: {
        configured: Boolean(instagramToken && (instagramUserId || metaWaToken)),
        ok: false,
        message: '',
        data: null,
      },
    }

    // 1. Testar WhatsApp Meta Cloud API
    if (metaWaToken && metaWaPhoneId) {
      try {
        const waRes = $http.send({
          url: 'https://graph.facebook.com/v21.0/' + metaWaPhoneId,
          method: 'GET',
          headers: {
            Authorization: 'Bearer ' + metaWaToken,
            Accept: 'application/json',
          },
          timeout: 15,
        })

        if (waRes.statusCode === 200 && waRes.json) {
          result.whatsapp.ok = true
          result.whatsapp.message = 'Conexão com WhatsApp Cloud API verificada com sucesso!'
          result.whatsapp.data = {
            verified_name: waRes.json.verified_name || waRes.json.display_phone_number || '',
            display_phone_number: waRes.json.display_phone_number || '',
            quality_rating: waRes.json.quality_rating || '',
            id: waRes.json.id,
          }
        } else {
          const errJson = waRes.json || {}
          const errDetail =
            (errJson.error && errJson.error.message) || 'Código HTTP ' + waRes.statusCode
          result.whatsapp.ok = false
          result.whatsapp.message = 'Meta rejeitou a credencial: ' + errDetail
        }
      } catch (waErr) {
        result.whatsapp.ok = false
        result.whatsapp.message =
          'Falha de rede ao conectar à Meta Cloud API: ' + (waErr.message || waErr)
      }
    } else {
      result.whatsapp.message = 'Token ou ID do número WhatsApp não configurados.'
    }

    // 2. Testar Instagram Graph API
    const effectiveIgToken = instagramToken || metaWaToken
    if (effectiveIgToken) {
      try {
        const endpoint = instagramUserId
          ? 'https://graph.facebook.com/v21.0/' +
            instagramUserId +
            '?fields=id,username,name,account_type'
          : 'https://graph.facebook.com/v21.0/me?fields=id,name'

        const igRes = $http.send({
          url: endpoint,
          method: 'GET',
          headers: {
            Authorization: 'Bearer ' + effectiveIgToken,
            Accept: 'application/json',
          },
          timeout: 15,
        })

        if (igRes.statusCode === 200 && igRes.json) {
          result.instagram.ok = true
          result.instagram.message = 'Conexão com Instagram Graph API verificada com sucesso!'
          result.instagram.data = igRes.json
        } else {
          const igErrJson = igRes.json || {}
          const igErrDetail =
            (igErrJson.error && igErrJson.error.message) || 'Código HTTP ' + igRes.statusCode
          result.instagram.ok = false
          result.instagram.message = 'Meta rejeitou o token do Instagram: ' + igErrDetail
        }
      } catch (igErr) {
        result.instagram.ok = false
        result.instagram.message =
          'Falha de rede ao conectar ao Instagram: ' + (igErr.message || igErr)
      }
    } else {
      result.instagram.message = 'Token do Instagram não configurado.'
    }

    return e.json(200, result)
  },
  $apis.requireAuth(),
)
