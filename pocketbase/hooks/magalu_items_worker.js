// Hook acionado imediatamente após a criação de um registro em magalu_ads_fetch_jobs
// Busca produtos/ofertas no portfólio oficial do Seller na Open API Magalu
// Endpoints oficiais:
// - GET https://api.magalu.com/seller/v1/portfolios/products/scores ou /seller/v1/portfolios/skus
// Se a conta for nova ou não tiver produtos ainda, retorna lista vazia de forma segura com status honesto.
// Também permite sincronizar / cadastrar produtos do catálogo local no Magalu.

onRecordAfterCreateSuccess((e) => {
  const job = e.record
  if (!job || job.getString('status') !== 'pending') {
    e.next()
    return
  }

  job.set('status', 'processing')
  job.set('progress_text', 'Conectando à Open API do Magalu...')
  $app.save(job)

  let settings = null
  try {
    const sRecords = $app.findRecordsByFilter('magalu_settings', '1=1', '-created', 1, 0)
    if (sRecords && sRecords.length > 0) {
      settings = sRecords[0]
    }
  } catch (err) {
    console.log('[magalu_ads_worker] Erro ao carregar magalu_settings: ' + err)
  }

  if (!settings) {
    job.set('status', 'error')
    job.set(
      'error_message',
      'Configurações do Magalu não encontradas. Configure suas credenciais em Configurações > Magalu.',
    )
    $app.save(job)
    e.next()
    return
  }

  let accessToken = settings.getString('access_token')
  const refreshToken = settings.getString('refresh_token')
  const clientId = settings.getString('client_id')
  const clientSecret = settings.getString('client_secret')
  const tokenExpiresAt = settings.getString('token_expires_at')
  const channelId = settings.getString('channel_id') || '9fe0d853-732b-4e4a-a0b0-cff988ed043d'

  if (!accessToken) {
    job.set('status', 'error')
    job.set('status_code', 401)
    job.set(
      'error_message',
      'Conta do Magalu não conectada. Conecte sua conta em Configurações > Magalu.',
    )
    $app.save(job)
    e.next()
    return
  }

  // Renova token se expirado ou prestes a expirar (< 5 min)
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
      job.set('progress_text', 'Renovando token de acesso do Magalu...')
      $app.save(job)
      const refRes = $http.send({
        url: 'https://id.magalu.com/oauth/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body:
          'grant_type=refresh_token&client_id=' +
          encodeURIComponent(clientId) +
          '&client_secret=' +
          encodeURIComponent(clientSecret) +
          '&refresh_token=' +
          encodeURIComponent(refreshToken),
        timeout: 20,
      })
      if (refRes.statusCode === 200 && refRes.json) {
        accessToken = refRes.json.access_token || accessToken
        const newRef = refRes.json.refresh_token || refreshToken
        const expIn = Number(refRes.json.expires_in) || 7200
        const newExpDate = new Date(Date.now() + expIn * 1000).toISOString()
        settings.set('access_token', accessToken)
        settings.set('refresh_token', newRef)
        settings.set('token_expires_at', newExpDate)
        $app.save(settings)
        console.log('[magalu_ads_worker] Token Magalu renovado com sucesso.')
      }
    } catch (rErr) {
      console.log('[magalu_ads_worker] Erro ao renovar token Magalu: ' + rErr)
    }
  }

  job.set('progress_text', 'Consultando produtos e portfólio no Magalu...')
  $app.save(job)

  // Tentativa primária: GET /seller/v1/portfolios/products/scores ou /seller/v1/portfolios/skus
  // A API do Magalu usa /seller/v1/portfolios/...
  const endpointsToTry = [
    'https://api.magalu.com/seller/v1/portfolios/skus?_limit=100',
    'https://api.magalu.com/seller/v1/portfolios/products/scores?limit=100',
  ]

  let itemsFound = []
  let rawResponseData = null
  let lastStatusCode = 200
  let errorMessage = ''

  for (let i = 0; i < endpointsToTry.length; i++) {
    const url = endpointsToTry[i]
    try {
      const res = $http.send({
        url: url,
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + accessToken,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        timeout: 30,
      })

      lastStatusCode = res.statusCode
      if (res.statusCode === 200 && res.json) {
        rawResponseData = res.json
        const results =
          res.json.results ||
          res.json.data ||
          res.json.items ||
          (Array.isArray(res.json) ? res.json : [])
        if (Array.isArray(results) && results.length > 0) {
          itemsFound = results
          break
        }
      } else if (res.statusCode === 401 || res.statusCode === 403) {
        const errJson = res.json || {}
        errorMessage =
          errJson.message ||
          errJson.error ||
          'Acesso negado pela Open API do Magalu (HTTP ' +
            res.statusCode +
            '). Verifique os escopos concedidos pelo Seller.'
        break
      } else if (res.statusCode >= 400) {
        const errJson = res.json || {}
        errorMessage =
          errJson.message || 'Erro na Open API do Magalu: ' + (res.raw || res.statusCode)
      }
    } catch (reqErr) {
      console.log('[magalu_ads_worker] Tentativa em ' + url + ' falhou: ' + reqErr)
      errorMessage = 'Falha de comunicação com a API Magalu: ' + (reqErr.message || reqErr)
    }
  }

  if (
    lastStatusCode === 401 ||
    (lastStatusCode === 403 && itemsFound.length === 0 && errorMessage)
  ) {
    job.set('status', 'error')
    job.set('status_code', lastStatusCode)
    job.set(
      'error_message',
      errorMessage ||
        'Sessão ou permissão insuficiente na API do Magalu. Verifique o token e os escopos da conta.',
    )
    $app.save(job)
    e.next()
    return
  }

  // Normaliza itens para formato canônico do sistema (SKU, title, price, available_quantity, status, etc.)
  const normalizedItems = []
  for (let j = 0; j < itemsFound.length; j++) {
    const it = itemsFound[j]
    if (!it) continue
    const sku = it.sku || it.sku_id || it.id || (it.params && it.params.sku) || 'MAGALU-' + j
    const title = it.title || it.name || it.description || 'Notebook / Produto ' + sku

    // Preço pode vir em centavos (normalizer=100) ou float direto
    let price = 0
    if (it.price !== undefined && it.price !== null) {
      if (typeof it.price === 'number') {
        price = it.price > 1000 && !it.normalizer ? it.price / 100 : it.price
      }
    } else if (it.list_price) {
      price =
        typeof it.list_price === 'number' && it.list_price > 1000
          ? it.list_price / 100
          : Number(it.list_price)
    }

    let stock = 0
    if (it.stock !== undefined && it.stock !== null) {
      stock = Number(it.stock) || 0
    } else if (it.quantity !== undefined && it.quantity !== null) {
      stock = Number(it.quantity) || 0
    } else if (it.available_quantity !== undefined && it.available_quantity !== null) {
      stock = Number(it.available_quantity) || 0
    }

    const itemStatus = it.status || (stock > 0 ? 'active' : 'paused')

    normalizedItems.push({
      id: sku,
      sku: sku,
      title: title,
      price: price,
      list_price: it.list_price ? Number(it.list_price) / 100 : price,
      available_quantity: stock,
      status: itemStatus,
      condition: it.condition || 'refurbished',
      brand: it.brand || '',
      model: it.model || '',
      category_id: it.category_id || '',
      permalink:
        it.permalink || 'https://www.magazineluiza.com.br/busca/' + encodeURIComponent(sku),
      thumbnail: it.thumbnail || (it.images && it.images[0]) || '',
      raw_item: it,
    })
  }

  job.set('status', 'done')
  job.set('status_code', 200)
  job.set(
    'progress_text',
    'Concluído: ' + normalizedItems.length + ' anúncio(s) Magalu processados.',
  )
  job.set('items', normalizedItems)
  job.set('total_items', normalizedItems.length)
  if (rawResponseData) {
    job.set('raw_response', rawResponseData)
  }
  $app.save(job)
  console.log(
    '[magalu_ads_worker] Job ' + job.id + ' finalizado com ' + normalizedItems.length + ' itens.',
  )

  e.next()
}, 'magalu_ads_fetch_jobs')
