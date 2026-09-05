// Hook acionado imediatamente após a criação de um registro em ml_ads_fetch_jobs
// Executa a busca de anúncios na API oficial do Mercado Livre via $http.send
// e salva o resultado no próprio registro do job.
// Tudo inline dentro do callback para respeitar o isolamento da VM Goja do PocketBase v0.36.

onRecordAfterCreateSuccess((e) => {
  const job = e.record
  if (!job || job.getString('status') !== 'pending') {
    e.next()
    return
  }

  job.set('status', 'processing')
  $app.save(job)

  // 1. Carregar ml_settings
  let settings = null
  try {
    const sRecords = $app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (sRecords && sRecords.length > 0) {
      settings = sRecords[0]
    }
  } catch (err) {
    console.log('[ml_ads_fetch_job] Erro ao carregar ml_settings: ' + err)
  }

  if (!settings) {
    job.set('status', 'error')
    job.set('status_code', 404)
    job.set('error_message', 'Configurações do Mercado Livre não encontradas no sistema.')
    $app.save(job)
    e.next()
    return
  }

  let accessToken = settings.getString('access_token')
  const refreshToken = settings.getString('refresh_token')
  const clientId = settings.getString('client_id')
  const clientSecret = settings.getString('client_secret')
  const tokenExpiresAt = settings.getString('token_expires_at')
  const userIdMl = settings.getString('user_id_ml')
  const nickname = settings.getString('nickname')

  if (!accessToken || !userIdMl) {
    job.set('status', 'error')
    job.set('status_code', 401)
    job.set(
      'error_message',
      'Mercado Livre não está conectado ou falta identificação do vendedor. Conecte sua conta em Configurações.',
    )
    $app.save(job)
    e.next()
    return
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
        console.log('[ml_ads_fetch_job] Token renovado com sucesso para seller ' + userIdMl)
      } else {
        console.log(
          '[ml_ads_fetch_job] Falha ao renovar token (HTTP ' +
            refRes.statusCode +
            '): ' +
            JSON.stringify(refRes.json),
        )
      }
    } catch (rErr) {
      console.log('[ml_ads_fetch_job] Erro ao renovar token ML: ' + rErr)
    }
  }

  // 3. Montar chamada de busca de itens do vendedor
  const limitVal = job.getInt('limit') || 50
  const offsetVal = job.getInt('offset') || 0
  const statusFilter = (job.getString('status_filter') || '').trim()

  let searchUrl =
    'https://api.mercadolibre.com/users/' +
    userIdMl +
    '/items/search?search_type=scan&limit=' +
    encodeURIComponent(String(limitVal))

  if (offsetVal > 0) {
    searchUrl += '&offset=' + encodeURIComponent(String(offsetVal))
  }
  if (statusFilter) {
    searchUrl += '&status=' + encodeURIComponent(statusFilter)
  }

  console.log('[ml_ads_fetch_job] Consultando itens ML: ' + searchUrl)

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
    const netMsg = sErr.message || String(sErr)
    console.log('[ml_ads_fetch_job] Erro de rede ao buscar itens: ' + netMsg)
    job.set('status', 'error')
    job.set('status_code', 502)
    job.set(
      'error_message',
      'Falha de comunicação ao conectar com a API do Mercado Livre: ' + netMsg,
    )
    $app.save(job)
    e.next()
    return
  }

  if (searchRes.statusCode === 401 || searchRes.statusCode === 403) {
    job.set('status', 'error')
    job.set('status_code', searchRes.statusCode)
    job.set(
      'error_message',
      'Token do Mercado Livre expirado ou sem permissão. Reconecte a conta em Configurações.',
    )
    $app.save(job)
    e.next()
    return
  }

  if (searchRes.statusCode >= 400) {
    const errJson = searchRes.json || {}
    const errMsg =
      errJson.message ||
      errJson.error_description ||
      errJson.error ||
      'Erro ao consultar anúncios do vendedor no Mercado Livre.'
    job.set('status', 'error')
    job.set('status_code', searchRes.statusCode)
    job.set('error_message', errMsg)
    $app.save(job)
    e.next()
    return
  }

  const searchData = searchRes.json || {}
  const itemIds = Array.isArray(searchData.results) ? searchData.results : []
  const paging = searchData.paging || {
    total: itemIds.length,
    offset: offsetVal,
    limit: itemIds.length,
  }

  if (itemIds.length === 0) {
    job.set('status', 'done')
    job.set('status_code', 200)
    job.set('seller_id', userIdMl)
    job.set('seller_nickname', nickname)
    job.set('items_count', 0)
    job.set('paging', paging)
    job.set('items', [])
    job.set('error_message', '')
    $app.save(job)
    console.log('[ml_ads_fetch_job] Concluído: 0 itens encontrados.')
    e.next()
    return
  }

  // 4. Detalhes dos itens via multiget: GET /items?ids=MLB1,MLB2,...
  // O Mercado Livre permite até 20 IDs por multiget no /items?ids=
  const detailedItems = []
  const batchSize = 20

  for (let i = 0; i < itemIds.length; i += batchSize) {
    const slice = itemIds.slice(i, i + batchSize)
    const multigetUrl =
      'https://api.mercadolibre.com/items?ids=' +
      slice.join(',') +
      '&attributes=id,title,price,currency_id,available_quantity,sold_quantity,condition,status,permalink,thumbnail,pictures,attributes,date_created,last_updated,listing_type_id,catalog_product_id,catalog_listing,domain_id'

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

            // Extrair GTIN e atributos principais
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

            // Foto principal com melhor resolução
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
              status: body.status,
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
              catalog_product_id: body.catalog_product_id || '',
              catalog_listing: Boolean(body.catalog_listing || body.catalog_product_id),
              domain_id: body.domain_id || '',
            })
          }
        }
      }
    } catch (mErr) {
      console.log('[ml_ads_fetch_job] Erro no multiget de itens: ' + mErr)
    }
  }

  job.set('status', 'done')
  job.set('status_code', 200)
  job.set('seller_id', userIdMl)
  job.set('seller_nickname', nickname)
  job.set('items_count', detailedItems.length)
  job.set('paging', paging)
  job.set('items', detailedItems)
  job.set('error_message', '')
  $app.save(job)
  console.log(
    '[ml_ads_fetch_job] Busca concluída com sucesso! Total de itens carregados: ' +
      detailedItems.length,
  )

  e.next()
}, 'ml_ads_fetch_jobs')

// Mantém endpoint HTTP legado em routerAdd caso o runtime passe a suportar rotas personalizadas
routerAdd('GET', '/api/ml/items', (e) => {
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

  const rawLimit = (e.request.url.query().get('limit') || '50').trim()
  const rawStatus = (e.request.url.query().get('status') || '').trim()
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

  try {
    const searchRes = $http.send({
      url: searchUrl,
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + accessToken,
        Accept: 'application/json',
      },
      timeout: 25,
    })

    if (searchRes.statusCode >= 400) {
      return e.json(searchRes.statusCode, searchRes.json || {})
    }

    return e.json(200, {
      seller_id: userIdMl,
      seller_nickname: nickname,
      items: searchRes.json?.results || [],
    })
  } catch (err) {
    return e.json(500, { error: err.message || String(err) })
  }
})
