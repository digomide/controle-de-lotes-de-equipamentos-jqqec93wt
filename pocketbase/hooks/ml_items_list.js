// Endpoint para listar anúncios do vendedor conectado no Mercado Livre (somente leitura)
// Route: GET /api/ml/items
// Reusa o padrão de renovação de access_token de ml_settings inline (isolamento de VM Goja)

routerAdd('GET', '/api/ml/items', (e) => {
  // 1. Carregar ml_settings
  let settings = null
  try {
    const sRecords = $app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (sRecords && sRecords.length > 0) {
      settings = sRecords[0]
    }
  } catch (err) {
    console.log('[ml_items_list] Erro ao carregar ml_settings: ' + err)
  }

  if (!settings) {
    return e.json(404, {
      error: 'Configurações do Mercado Livre não encontradas.',
      connected: false,
    })
  }

  let accessToken = settings.getString('access_token')
  const refreshToken = settings.getString('refresh_token')
  const clientId = settings.getString('client_id')
  const clientSecret = settings.getString('client_secret')
  const tokenExpiresAt = settings.getString('token_expires_at')
  const userIdMl = settings.getString('user_id_ml')
  const nickname = settings.getString('nickname')

  if (!accessToken || !userIdMl) {
    return e.json(401, {
      error: 'Mercado Livre não está conectado ou falta identificação de vendedor.',
      connected: false,
    })
  }

  // 2. Renovar token se necessário (expirando nos próximos 5 minutos)
  let needRefresh = false
  if (tokenExpiresAt) {
    try {
      const expTime = new Date(tokenExpiresAt).getTime()
      if (Date.now() + 5 * 60 * 1000 >= expTime) {
        needRefresh = true
      }
    } catch (_) {}
  }

  if (needRefresh && refreshToken && clientId && clientSecret) {
    try {
      const refRes = $http.send({
        url: 'https://api.mercadolibre.com/oauth/token',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
        }),
        timeout: 20,
      })
      if (refRes.statusCode === 200 && refRes.json) {
        accessToken = refRes.json.access_token || accessToken
        const newRef = refRes.json.refresh_token || refreshToken
        const expIn = Number(refRes.json.expires_in) || 21600
        const newExpDate = new Date(Date.now() + expIn * 1000).toISOString()
        settings.set('access_token', accessToken)
        settings.set('refresh_token', newRef)
        settings.set('token_expires_at', newExpDate)
        $app.save(settings)
        console.log('[ml_items_list] Token renovado com sucesso para seller ' + userIdMl)
      } else {
        console.log(
          '[ml_items_list] Falha ao renovar token (HTTP ' +
            refRes.statusCode +
            '): ' +
            JSON.stringify(refRes.json),
        )
      }
    } catch (rErr) {
      console.log('[ml_items_list] Erro ao renovar token ML: ' + rErr)
    }
  }

  // 3. Chamar API do ML para buscar IDs de anúncios do vendedor
  // Endpoint oficial: GET /users/{user_id}/items/search?search_type=scan&limit=50
  // Também suporta paginação / status filter via query params se enviados
  const rawLimit = (e.request.url.query().get('limit') || '50').trim()
  const rawStatus = (e.request.url.query().get('status') || '').trim() // active, paused, closed
  const rawOffset = (e.request.url.query().get('offset') || '0').trim()

  let searchUrl =
    'https://api.mercadolibre.com/users/' +
    userIdMl +
    '/items/search?search_type=scan&limit=' +
    encodeURIComponent(rawLimit)

  if (rawOffset && rawOffset !== '0') {
    searchUrl += '&offset=' + encodeURIComponent(rawOffset)
  }
  if (rawStatus) {
    searchUrl += '&status=' + encodeURIComponent(rawStatus)
  }

  let searchRes = null
  try {
    searchRes = $http.send({
      url: searchUrl,
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + accessToken,
        Accept: 'application/json',
      },
      timeout: 25,
    })
  } catch (sErr) {
    console.log('[ml_items_list] Erro de rede ao buscar itens: ' + sErr)
    return e.json(502, {
      error:
        'Falha de comunicação ao conectar com a API do Mercado Livre: ' + (sErr.message || sErr),
    })
  }

  if (searchRes.statusCode === 401 || searchRes.statusCode === 403) {
    return e.json(401, {
      error:
        'Token do Mercado Livre expirado ou sem permissão. Reconecte a conta em Configurações.',
      statusCode: searchRes.statusCode,
      raw: searchRes.json,
    })
  }

  if (searchRes.statusCode >= 400) {
    const errJson = searchRes.json || {}
    return e.json(searchRes.statusCode, {
      error:
        errJson.message ||
        errJson.error_description ||
        errJson.error ||
        'Erro ao consultar anúncios do vendedor no Mercado Livre.',
      raw: errJson,
    })
  }

  const searchData = searchRes.json || {}
  const itemIds = Array.isArray(searchData.results) ? searchData.results : []
  const paging = searchData.paging || { total: itemIds.length, offset: 0, limit: itemIds.length }

  if (itemIds.length === 0) {
    return e.json(200, {
      seller_id: userIdMl,
      seller_nickname: nickname,
      paging: paging,
      items: [],
      total: 0,
    })
  }

  // 4. Detalhes dos itens via multiget: GET /items?ids=MLB1,MLB2,...
  // O Mercado Livre permite até 20 IDs por multiget no /items?ids=
  // Para 50 itens, fazemos lotes de até 20
  const detailedItems = []
  const batchSize = 20

  for (let i = 0; i < itemIds.length; i += batchSize) {
    const slice = itemIds.slice(i, i + batchSize)
    const multigetUrl =
      'https://api.mercadolibre.com/items?ids=' +
      slice.join(',') +
      '&attributes=id,title,price,currency_id,available_quantity,sold_quantity,condition,status,permalink,thumbnail,pictures,attributes,date_created,last_updated,listing_type_id'

    try {
      const multiRes = $http.send({
        url: multigetUrl,
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + accessToken,
          Accept: 'application/json',
        },
        timeout: 25,
      })

      if (multiRes.statusCode === 200 && Array.isArray(multiRes.json)) {
        for (let j = 0; j < multiRes.json.length; j++) {
          const entry = multiRes.json[j]
          if (entry && entry.code === 200 && entry.body) {
            const body = entry.body

            // Extrair GTIN dos atributos se existir
            let gtin = ''
            let brand = ''
            let model = ''
            let line = ''
            if (Array.isArray(body.attributes)) {
              for (let a = 0; a < body.attributes.length; a++) {
                const attr = body.attributes[a]
                if (attr.id === 'GTIN') gtin = attr.value_name || ''
                if (attr.id === 'BRAND') brand = attr.value_name || ''
                if (attr.id === 'MODEL') model = attr.value_name || ''
                if (attr.id === 'LINE') line = attr.value_name || ''
              }
            }

            // Foto principal de melhor resolução se houver
            let primaryPicture = body.thumbnail || ''
            if (Array.isArray(body.pictures) && body.pictures.length > 0) {
              const pic0 = body.pictures[0]
              if (pic0 && (pic0.secure_url || pic0.url)) {
                primaryPicture = pic0.secure_url || pic0.url
              }
            }

            detailedItems.push({
              id: body.id,
              title: body.title,
              price: body.price,
              currency_id: body.currency_id || 'BRL',
              available_quantity: body.available_quantity,
              sold_quantity: body.sold_quantity || 0,
              condition: body.condition,
              status: body.status, // active, paused, closed
              permalink: body.permalink,
              thumbnail: primaryPicture || body.thumbnail,
              pictures_count: Array.isArray(body.pictures) ? body.pictures.length : 0,
              listing_type_id: body.listing_type_id,
              date_created: body.date_created,
              last_updated: body.last_updated,
              gtin: gtin,
              brand: brand,
              model: model,
              line: line,
            })
          }
        }
      }
    } catch (mErr) {
      console.log('[ml_items_list] Erro no multiget de itens: ' + mErr)
    }
  }

  return e.json(200, {
    seller_id: userIdMl,
    seller_nickname: nickname,
    paging: paging,
    items: detailedItems,
    total: detailedItems.length,
  })
})
