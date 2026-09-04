// Rota POST /api/ml/publish - Publica anúncio de equipamento no Mercado Livre
// Cria o item via POST https://api.mercadolibre.com/items
// Salva ml_listing_id, ml_listing_url, ml_listing_status e ml_published_at no produto

routerAdd(
  'POST',
  '/api/ml/publish',
  (e) => {
    const body = e.requestInfo().body || {}
    const productId = (body.product_id || '').toString().trim()
    const customTitle = (body.title || '').toString().trim()
    const customPrice = Number(body.price)
    const customCategory = (body.category_id || 'MLB1652').toString().trim()
    const customDescription = (body.description || '').toString().trim()
    const customPictures = Array.isArray(body.pictures) ? body.pictures : []

    if (!productId) {
      return e.json(400, { error: 'ID do produto é obrigatório.' })
    }

    // Carregar configurações e token do ML
    let settings = null
    try {
      const records = $app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
      if (records && records.length > 0) {
        settings = records[0]
      }
    } catch (_) {}

    if (!settings || !settings.getString('access_token')) {
      return e.json(400, {
        error: 'Mercado Livre não está conectado. Acesse Configurações para conectar sua conta.',
        not_connected: true,
      })
    }

    // Obter produto
    let product = null
    try {
      product = $app.findRecordById('products', productId)
    } catch (err) {
      return e.json(404, { error: 'Produto não encontrado.' })
    }

    let accessToken = settings.getString('access_token')
    const refreshToken = settings.getString('refresh_token')
    const clientId = settings.getString('client_id')
    const clientSecret = settings.getString('client_secret')
    const tokenExpiresAt = settings.getString('token_expires_at')

    // Verificar se token expirou ou expira em menos de 5 minutos
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
        }
      } catch (rErr) {
        console.log('Error refreshing ML token: ' + rErr)
      }
    }

    // Preparar dados do anúncio
    const title = (customTitle || product.getString('name')).slice(0, 60)
    const price =
      !isNaN(customPrice) && customPrice > 0 ? customPrice : product.getFloat('unit_price')
    const categoryId = customCategory || 'MLB1652'

    // Formatar imagens para o Mercado Livre: [{ source: "url" }]
    let pictureObjects = []
    if (customPictures.length > 0) {
      pictureObjects = customPictures.map((u) => ({ source: u }))
    } else {
      // Coletar do produto: fotos do storage e/ou URLs externas
      const photosRaw = product.get('photos')
      if (photosRaw && Array.isArray(photosRaw)) {
        const pbcBase = $os.getenv('VITE_POCKETBASE_URL') || ''
        const colId = product.collection().id
        const pId = product.id
        for (let i = 0; i < photosRaw.length; i++) {
          const fn = (photosRaw[i] || '').toString().trim()
          if (fn) {
            pictureObjects.push({ source: pbcBase + '/api/files/' + colId + '/' + pId + '/' + fn })
          }
        }
      }

      const imagesRaw = product.get('images')
      if (imagesRaw && Array.isArray(imagesRaw)) {
        for (let i = 0; i < imagesRaw.length; i++) {
          const imgUrl = (imagesRaw[i] || '').toString().trim()
          if (imgUrl.startsWith('http://') || imgUrl.startsWith('https://')) {
            pictureObjects.push({ source: imgUrl })
          }
        }
      }
    }

    // Mercado Livre exige pelo menos 1 foto válida acessível publicamente via URL
    if (pictureObjects.length === 0) {
      return e.json(400, {
        error: 'O anúncio exige pelo menos uma foto com URL pública válida.',
      })
    }

    // Montar payload padrão para Notebooks no Mercado Livre Brasil
    const itemPayload = {
      title: title,
      category_id: categoryId,
      price: price,
      currency_id: 'BRL',
      available_quantity: 1,
      buying_mode: 'buy_it_now',
      listing_type_id: 'gold_special', // Clássico padrão ML
      condition: 'used',
      pictures: pictureObjects,
      channels: ['marketplace'],
    }

    // Criar o item no Mercado Livre
    let createRes = null
    try {
      createRes = $http.send({
        url: 'https://api.mercadolibre.com/items',
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + accessToken,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(itemPayload),
        timeout: 30,
      })
    } catch (netErr) {
      return e.json(502, { error: 'Falha de rede ao conectar à API do Mercado Livre: ' + netErr })
    }

    if (createRes.statusCode >= 400) {
      const errJson = createRes.json || {}
      let detailedMsg = errJson.message || 'Erro desconhecido ao criar anúncio no Mercado Livre.'
      if (errJson.cause && Array.isArray(errJson.cause) && errJson.cause.length > 0) {
        const causes = errJson.cause.map((c) => c.message || c.code || JSON.stringify(c)).join('; ')
        detailedMsg += ' Detalhes: ' + causes
      }
      return e.json(createRes.statusCode, {
        error: detailedMsg,
        raw: errJson,
      })
    }

    const createdItem = createRes.json || {}
    const itemId = createdItem.id || ''
    const permalink = createdItem.permalink || ''
    const itemStatus = createdItem.status || 'active'

    // Se houver descrição em texto puro, adicioná-la via POST /items/{id}/description
    if (itemId && customDescription) {
      try {
        $http.send({
          url: 'https://api.mercadolibre.com/items/' + itemId + '/description',
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + accessToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ plain_text: customDescription }),
          timeout: 20,
        })
      } catch (dErr) {
        console.log('Error adding description to ML item ' + itemId + ': ' + dErr)
      }
    }

    // Salvar referências no produto PocketBase
    product.set('ml_listing_id', itemId)
    product.set('ml_listing_url', permalink)
    product.set('ml_listing_status', itemStatus)
    product.set('ml_published_at', new Date().toISOString())

    // Adicionar evento no histórico do produto
    const currentEvents = product.get('history_events') || []
    const eventsList = Array.isArray(currentEvents) ? [...currentEvents] : []
    eventsList.push({
      title: 'Anunciado no Mercado Livre (' + itemId + ')',
      date: new Date().toISOString().replace('T', ' ').slice(0, 19),
    })
    product.set('history_events', eventsList)

    $app.save(product)

    return e.json(200, {
      success: true,
      ml_listing_id: itemId,
      ml_listing_url: permalink,
      ml_listing_status: itemStatus,
    })
  },
  $apis.requireAuth(),
)
