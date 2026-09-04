// Hook acionado imediatamente após a criação de um registro em ml_publish_queue
// Garante token válido, monta dados e publica anúncio no Mercado Livre
// Tudo inline dentro do callback para respeitar a VM isolada do PocketBase

onRecordAfterCreateSuccess((e) => {
  const pubItem = e.record
  if (!pubItem || pubItem.getString('status') !== 'pending') {
    e.next()
    return
  }

  pubItem.set('status', 'processing')
  $app.save(pubItem)

  let settings = null
  try {
    const sRecords = $app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (sRecords && sRecords.length > 0) {
      settings = sRecords[0]
    }
  } catch (err) {
    console.log('[ml_publish_hook] Erro ao carregar ml_settings: ' + err)
  }

  if (!settings) {
    pubItem.set('status', 'error')
    pubItem.set('error_message', 'Configurações do Mercado Livre não encontradas.')
    $app.save(pubItem)
    e.next()
    return
  }

  let accessToken = settings.getString('access_token')
  const refreshToken = settings.getString('refresh_token')
  const clientId = settings.getString('client_id')
  const clientSecret = settings.getString('client_secret')
  const tokenExpiresAt = settings.getString('token_expires_at')

  if (!accessToken) {
    pubItem.set('status', 'error')
    pubItem.set(
      'error_message',
      'Mercado Livre não está conectado. Conecte sua conta em Configurações.',
    )
    $app.save(pubItem)
    e.next()
    return
  }

  // Renovar token se expirando nos próximos 5 minutos
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
      console.log('[ml_publish_hook] Erro ao renovar token ML: ' + rErr)
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
    e.next()
    return
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
    e.next()
    return
  }

  // Mapeamento ITEM_CONDITION do Mercado Livre:
  // novo -> "new", usado -> "used", recondicionado -> "refurbished", caixa_aberta -> "clipped"
  const rawType = (payload.condition_type || product.getString('condition_type') || '')
    .toLowerCase()
    .trim()
  const rawGrade = (payload.condition_grade || product.getString('condition_grade') || '')
    .toLowerCase()
    .trim()

  let mlCondition = 'used'
  if (rawType === 'novo' || rawType === 'new') {
    mlCondition = 'new'
  } else if (rawType === 'caixa_aberta' || rawType === 'clipped') {
    mlCondition = 'clipped'
  } else if (rawType === 'recondicionado' || rawType === 'refurbished') {
    mlCondition = 'refurbished'
  } else if (rawType === 'usado' || rawType === 'used') {
    mlCondition = 'used'
  } else {
    // Inferência por legado se não estiver setado
    const leg = (product.getString('condition') || '').toLowerCase()
    if (leg.includes('novo')) mlCondition = 'new'
    else if (leg.includes('caixa')) mlCondition = 'clipped'
    else mlCondition = 'refurbished'
  }

  // Grau em recondicionados ou usados (Excelente, Bom, Aceitável)
  const gradeLabelMap = {
    excelente: 'Excelente',
    bom: 'Bom',
    aceitavel: 'Aceitável',
  }
  const gradeLabel = gradeLabelMap[rawGrade] || ''

  // Atributos de item (ITEM_GRADE e ITEM_CONDITION)
  const itemAttributes = []
  if (gradeLabel) {
    itemAttributes.push({
      id: 'ITEM_GRADE',
      value_name: gradeLabel,
    })
  }

  const itemPayload = {
    title: title,
    category_id: categoryId,
    price: price,
    currency_id: 'BRL',
    available_quantity: 1,
    buying_mode: 'buy_it_now',
    listing_type_id: listingTypeId,
    condition: mlCondition,
    pictures: pictureObjects,
    channels: ['marketplace'],
  }
  if (itemAttributes.length > 0) {
    itemPayload.attributes = itemAttributes
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
    e.next()
    return
  }

  // Se falhar com erro de atributo (ex: ITEM_GRADE não aceito na categoria), tentar novamente sem attributes
  if (createRes.statusCode >= 400 && itemPayload.attributes && itemPayload.attributes.length > 0) {
    const errJsonTemp = createRes.json || {}
    const errMsgTemp = JSON.stringify(errJsonTemp).toLowerCase()
    if (
      errMsgTemp.includes('attribute') ||
      errMsgTemp.includes('item_grade') ||
      errMsgTemp.includes('invalid_attribute')
    ) {
      console.log('[ml_publish_hook] Tentando novamente sem o atributo ITEM_GRADE...')
      delete itemPayload.attributes
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
      } catch (retryErr) {
        console.log('[ml_publish_hook] Erro ao retentar sem attributes: ' + retryErr)
      }
    }
  }

  if (createRes.statusCode >= 400) {
    const errJson = createRes.json || {}
    let detailedMsg =
      errJson.error_description ||
      errJson.message ||
      errJson.error ||
      'Erro ao criar anúncio no Mercado Livre (HTTP ' + createRes.statusCode + ').'
    if (errJson.cause && Array.isArray(errJson.cause) && errJson.cause.length > 0) {
      const causes = errJson.cause.map((c) => c.message || c.code || JSON.stringify(c)).join('; ')
      detailedMsg += ' Detalhes: ' + causes
    }
    pubItem.set('status', 'error')
    pubItem.set('error_message', detailedMsg)
    $app.save(pubItem)
    e.next()
    return
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
      console.log('[ml_publish_hook] Erro ao enviar descrição ML para ' + itemId + ': ' + dErr)
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
  console.log('[ml_publish_hook] Anúncio publicado com sucesso: ' + itemId)

  e.next()
}, 'ml_publish_queue')
