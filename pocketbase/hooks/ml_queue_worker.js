// Worker cron de contingência para as filas do Mercado Livre
// Processa quaisquer itens que permanecerem com status 'pending'
// Executa a cada 15 segundos: @every 15s

cronAdd('ml_queue_worker', '@every 15s', () => {
  let settings = null
  try {
    const sRecords = $app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (sRecords && sRecords.length > 0) {
      settings = sRecords[0]
    }
  } catch (err) {
    console.log('[ml_cron] Erro ao carregar ml_settings: ' + err)
  }

  // 1. Processar ml_oauth_requests pendentes
  try {
    const pendingOAuth = $app.findRecordsByFilter(
      'ml_oauth_requests',
      "status = 'pending'",
      'created',
      5,
      0,
    )

    for (let i = 0; i < pendingOAuth.length; i++) {
      const req = pendingOAuth[i]
      const code = req.getString('code')
      const customRedirectUri = req.getString('redirect_uri')

      if (!settings) {
        req.set('status', 'error')
        req.set('error_message', 'Configurações do Mercado Livre não encontradas no sistema.')
        $app.save(req)
        continue
      }

      const clientId = settings.getString('client_id')
      const clientSecret = settings.getString('client_secret')
      const redirectUri = customRedirectUri || settings.getString('redirect_uri')

      if (!clientId || !clientSecret) {
        req.set('status', 'error')
        req.set('error_message', 'Client ID ou Client Secret do Mercado Livre não configurados.')
        $app.save(req)
        continue
      }

      let tokenRes = null
      try {
        tokenRes = $http.send({
          url: 'https://api.mercadolibre.com/oauth/token',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            grant_type: 'authorization_code',
            client_id: clientId,
            client_secret: clientSecret,
            code: code,
            redirect_uri: redirectUri,
          }),
          timeout: 30,
        })
      } catch (netErr) {
        req.set('status', 'error')
        req.set(
          'error_message',
          'Falha de rede ao conectar ao Mercado Livre: ' + (netErr.message || netErr),
        )
        $app.save(req)
        continue
      }

      if (tokenRes.statusCode >= 400) {
        const errJson = tokenRes.json || {}
        const errorDesc =
          errJson.error_description ||
          errJson.message ||
          errJson.error ||
          'Falha na autenticação OAuth do Mercado Livre (status ' + tokenRes.statusCode + ').'
        req.set('status', 'error')
        req.set('error_message', errorDesc)
        $app.save(req)
        continue
      }

      const tokenData = tokenRes.json || {}
      const accessToken = tokenData.access_token || ''
      const refreshToken = tokenData.refresh_token || ''
      const expiresIn = Number(tokenData.expires_in) || 21600
      const userId = (tokenData.user_id || '').toString()

      if (!accessToken) {
        req.set('status', 'error')
        req.set('error_message', 'Mercado Livre não retornou access_token válido.')
        $app.save(req)
        continue
      }

      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

      let nickname = ''
      let permalink = ''
      try {
        const userRes = $http.send({
          url: 'https://api.mercadolibre.com/users/me',
          method: 'GET',
          headers: {
            Authorization: 'Bearer ' + accessToken,
          },
          timeout: 15,
        })
        if (userRes.statusCode === 200 && userRes.json) {
          nickname = userRes.json.nickname || ''
          permalink = userRes.json.permalink || ''
        }
      } catch (uErr) {
        console.log('[ml_cron] Erro ao buscar perfil ML: ' + uErr)
      }

      settings.set('access_token', accessToken)
      settings.set('refresh_token', refreshToken)
      settings.set('token_expires_at', expiresAt)
      settings.set('user_id_ml', userId)
      settings.set('nickname', nickname)
      settings.set('permalink_seller', permalink)
      if (redirectUri && !settings.getString('redirect_uri')) {
        settings.set('redirect_uri', redirectUri)
      }
      $app.save(settings)

      req.set('status', 'done')
      req.set('error_message', '')
      $app.save(req)
      console.log('[ml_cron] OAuth concluído para: ' + nickname)
    }
  } catch (oauthErr) {
    console.log('[ml_cron] Erro em ml_oauth_requests: ' + oauthErr)
  }

  // 2. Processar ml_publish_queue pendentes
  try {
    const pendingPublish = $app.findRecordsByFilter(
      'ml_publish_queue',
      "status = 'pending'",
      'created',
      5,
      0,
    )

    for (let i = 0; i < pendingPublish.length; i++) {
      const pubItem = pendingPublish[i]
      pubItem.set('status', 'processing')
      $app.save(pubItem)

      if (!settings) {
        pubItem.set('status', 'error')
        pubItem.set('error_message', 'Configurações do Mercado Livre não encontradas.')
        $app.save(pubItem)
        continue
      }

      let accessToken = settings.getString('access_token')
      const refreshToken = settings.getString('refresh_token')
      const clientId = settings.getString('client_id')
      const clientSecret = settings.getString('client_secret')
      const tokenExpiresAt = settings.getString('token_expires_at')

      if (!accessToken) {
        pubItem.set('status', 'error')
        pubItem.set('error_message', 'Mercado Livre não está conectado.')
        $app.save(pubItem)
        continue
      }

      // Renovação se necessário
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
          console.log('[ml_cron] Erro ao renovar token ML: ' + rErr)
        }
      }

      const productId = pubItem.getString('product')
      let product = null
      try {
        product = $app.findRecordById('products', productId)
      } catch (pErr) {
        pubItem.set('status', 'error')
        pubItem.set('error_message', 'Produto associado não encontrado: ' + productId)
        $app.save(pubItem)
        continue
      }

      const payload = pubItem.get('payload') || {}
      const title = (payload.title || product.getString('name') || '').trim().slice(0, 60)
      const price =
        !isNaN(Number(payload.price)) && Number(payload.price) > 0
          ? Number(payload.price)
          : product.getFloat('unit_price')
      const categoryId = payload.category_id || 'MLB1652'
      const customDescription = (payload.description || '').toString().trim()
      const customPictures = Array.isArray(payload.photos) ? payload.photos : []
      const listingTypeId = payload.listing_type_id || 'gold_special'

      let pictureObjects = []
      if (customPictures.length > 0) {
        for (let pIdx = 0; pIdx < customPictures.length; pIdx++) {
          const u = (customPictures[pIdx] || '').toString().trim()
          if (u) pictureObjects.push({ source: u })
        }
      } else {
        const photosRaw = product.get('photos')
        if (photosRaw && Array.isArray(photosRaw)) {
          const pbcBase = $os.getenv('VITE_POCKETBASE_URL') || ''
          const colId = product.collection().id
          const pId = product.id
          for (let pIdx = 0; pIdx < photosRaw.length; pIdx++) {
            const fn = (photosRaw[pIdx] || '').toString().trim()
            if (fn) {
              pictureObjects.push({
                source: pbcBase + '/api/files/' + colId + '/' + pId + '/' + fn,
              })
            }
          }
        }
        const imagesRaw = product.get('images')
        if (imagesRaw && Array.isArray(imagesRaw)) {
          for (let pIdx = 0; pIdx < imagesRaw.length; pIdx++) {
            const imgUrl = (imagesRaw[pIdx] || '').toString().trim()
            if (imgUrl.startsWith('http://') || imgUrl.startsWith('https://')) {
              pictureObjects.push({ source: imgUrl })
            }
          }
        }
      }

      if (pictureObjects.length === 0) {
        pubItem.set('status', 'error')
        pubItem.set('error_message', 'O anúncio exige pelo menos uma foto com URL pública válida.')
        $app.save(pubItem)
        continue
      }

      const itemPayload = {
        title: title,
        category_id: categoryId,
        price: price,
        currency_id: 'BRL',
        available_quantity: 1,
        buying_mode: 'buy_it_now',
        listing_type_id: listingTypeId,
        condition: 'used',
        pictures: pictureObjects,
        channels: ['marketplace'],
      }

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
        pubItem.set('status', 'error')
        pubItem.set(
          'error_message',
          'Falha de rede ao criar item no Mercado Livre: ' + (netErr.message || netErr),
        )
        $app.save(pubItem)
        continue
      }

      if (createRes.statusCode >= 400) {
        const errJson = createRes.json || {}
        let detailedMsg =
          errJson.error_description ||
          errJson.message ||
          errJson.error ||
          'Erro ao criar anúncio no Mercado Livre (HTTP ' + createRes.statusCode + ').'
        if (errJson.cause && Array.isArray(errJson.cause) && errJson.cause.length > 0) {
          const causes = errJson.cause
            .map((c) => c.message || c.code || JSON.stringify(c))
            .join('; ')
          detailedMsg += ' Detalhes: ' + causes
        }
        pubItem.set('status', 'error')
        pubItem.set('error_message', detailedMsg)
        $app.save(pubItem)
        continue
      }

      const createdItem = createRes.json || {}
      const itemId = createdItem.id || ''
      const permalink = createdItem.permalink || ''
      const itemStatus = createdItem.status || 'active'

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
          console.log('[ml_cron] Erro ao enviar descrição ML para ' + itemId + ': ' + dErr)
        }
      }

      product.set('ml_listing_id', itemId)
      product.set('ml_listing_url', permalink)
      product.set('ml_listing_status', itemStatus)
      product.set('ml_published_at', new Date().toISOString())

      const currentEvents = product.get('history_events') || []
      const eventsList = Array.isArray(currentEvents) ? [...currentEvents] : []
      eventsList.push({
        title: 'Anunciado no Mercado Livre (' + itemId + ')',
        date: new Date().toISOString().replace('T', ' ').slice(0, 19),
      })
      product.set('history_events', eventsList)
      $app.save(product)

      pubItem.set('status', 'done')
      pubItem.set('error_message', '')
      pubItem.set('result', {
        ml_listing_id: itemId,
        ml_listing_url: permalink,
        ml_listing_status: itemStatus,
      })
      $app.save(pubItem)
      console.log('[ml_cron] Anúncio publicado com sucesso: ' + itemId)
    }
  } catch (publishErr) {
    console.log('[ml_cron] Erro em ml_publish_queue: ' + publishErr)
  }

  // 3. Processar ml_item_queue pendentes
  try {
    const pendingItems = $app.findRecordsByFilter(
      'ml_item_queue',
      "status = 'pending'",
      'created',
      5,
      0,
    )

    for (let i = 0; i < pendingItems.length; i++) {
      const itemAction = pendingItems[i]
      itemAction.set('status', 'processing')
      $app.save(itemAction)

      if (!settings) {
        itemAction.set('status', 'error')
        itemAction.set('error_message', 'Configurações do Mercado Livre não encontradas.')
        $app.save(itemAction)
        continue
      }

      const accessToken = settings.getString('access_token')
      if (!accessToken) {
        itemAction.set('status', 'error')
        itemAction.set('error_message', 'Mercado Livre não conectado.')
        $app.save(itemAction)
        continue
      }

      const productId = itemAction.getString('product')
      let product = null
      let mlListingId = ''
      if (productId) {
        try {
          product = $app.findRecordById('products', productId)
          mlListingId = product.getString('ml_listing_id')
        } catch (_) {}
      }

      if (!mlListingId) {
        itemAction.set('status', 'error')
        itemAction.set('error_message', 'Produto não possui ml_listing_id vinculado.')
        $app.save(itemAction)
        continue
      }

      const rawAction = itemAction.getString('action')
      let targetStatus = 'active'
      if (rawAction === 'pause') targetStatus = 'paused'
      else if (rawAction === 'close') targetStatus = 'closed'
      else if (rawAction === 'activate') targetStatus = 'active'

      let updateRes = null
      try {
        updateRes = $http.send({
          url: 'https://api.mercadolibre.com/items/' + mlListingId,
          method: 'PUT',
          headers: {
            Authorization: 'Bearer ' + accessToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: targetStatus }),
          timeout: 20,
        })
      } catch (uNetErr) {
        itemAction.set('status', 'error')
        itemAction.set(
          'error_message',
          'Falha de rede ao alterar status do anúncio: ' + (uNetErr.message || uNetErr),
        )
        $app.save(itemAction)
        continue
      }

      if (updateRes.statusCode >= 400) {
        const errJson = updateRes.json || {}
        itemAction.set('status', 'error')
        itemAction.set(
          'error_message',
          errJson.error_description ||
            errJson.message ||
            errJson.error ||
            'Falha ao atualizar status no ML (HTTP ' + updateRes.statusCode + ').',
        )
        $app.save(itemAction)
        continue
      }

      if (product) {
        product.set('ml_listing_status', targetStatus)
        $app.save(product)
      }

      itemAction.set('status', 'done')
      itemAction.set('error_message', '')
      itemAction.set('result', {
        ml_listing_id: mlListingId,
        status: targetStatus,
      })
      $app.save(itemAction)
      console.log('[ml_cron] Status do anúncio atualizado para ' + targetStatus)
    }
  } catch (itemErr) {
    console.log('[ml_cron] Erro em ml_item_queue: ' + itemErr)
  }
})
