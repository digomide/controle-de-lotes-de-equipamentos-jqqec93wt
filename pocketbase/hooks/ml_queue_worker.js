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
      const categoryId = (payload.category_id || 'MLB1652').trim()
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
        const leg = (product.getString('condition') || '').toLowerCase()
        if (leg.includes('novo')) mlCondition = 'new'
        else if (leg.includes('caixa')) mlCondition = 'clipped'
        else mlCondition = 'refurbished'
      }

      const gradeLabelMap = {
        excelente: 'Excelente',
        bom: 'Bom',
        aceitavel: 'Aceitável',
      }
      const gradeLabel = gradeLabelMap[rawGrade] || ''

      // 1. Obter metadados dos atributos obrigatórios da categoria no ML via GET /categories/{category_id}/attributes
      let categoryAttributesMeta = []
      try {
        const catAttrRes = $http.send({
          url: 'https://api.mercadolibre.com/categories/' + categoryId + '/attributes',
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
          timeout: 15,
        })
        if (catAttrRes.statusCode === 200 && Array.isArray(catAttrRes.json)) {
          categoryAttributesMeta = catAttrRes.json
        }
      } catch (cErr) {
        console.log(
          '[ml_cron] Erro ao consultar atributos da categoria ' + categoryId + ': ' + cErr,
        )
      }

      const requiredAttrMap = {}
      for (let m = 0; m < categoryAttributesMeta.length; m++) {
        const attrDef = categoryAttributesMeta[m] || {}
        const tags = attrDef.tags || {}
        const isRequired =
          tags.required === true ||
          tags.catalog_required === true ||
          (tags.conditional_required === true &&
            mlCondition === 'refurbished' &&
            attrDef.id === 'GRADING')
        if (isRequired && attrDef.id) {
          requiredAttrMap[attrDef.id] = attrDef
        }
      }

      const pBrand = (product.getString('brand') || '').trim()
      const pModel = (product.getString('model') || '').trim()
      const pProcessor = (product.getString('processor') || '').trim()
      const pRam = (product.getString('ram') || '').trim()
      const pStorage = (product.getString('storage') || '').trim()
      const pScreen = (product.getString('screen_size') || '').trim()
      const pName = (product.getString('name') || '').trim()

      let brandVal = pBrand
      if (!brandVal) {
        if (pName.toLowerCase().includes('lenovo')) brandVal = 'Lenovo'
        else if (pName.toLowerCase().includes('dell')) brandVal = 'Dell'
        else if (pName.toLowerCase().includes('hp')) brandVal = 'HP'
        else if (pName.toLowerCase().includes('apple')) brandVal = 'Apple'
        else if (pName.toLowerCase().includes('acer')) brandVal = 'Acer'
        else if (pName.toLowerCase().includes('asus')) brandVal = 'Asus'
        else if (pName.toLowerCase().includes('samsung')) brandVal = 'Samsung'
        else if (pName.toLowerCase().includes('positivo')) brandVal = 'Positivo'
      }

      let modelVal = pModel
      if (!modelVal) {
        modelVal = title.replace(brandVal, '').trim() || pName.slice(0, 60)
      }

      let familyVal = ''
      const combinedText = (pModel + ' ' + pName).trim()
      if (/thinkpad/i.test(combinedText)) familyVal = 'ThinkPad'
      else if (/ideapad/i.test(combinedText)) familyVal = 'IdeaPad'
      else if (/latitude/i.test(combinedText)) familyVal = 'Latitude'
      else if (/inspiron/i.test(combinedText)) familyVal = 'Inspiron'
      else if (/vostro/i.test(combinedText)) familyVal = 'Vostro'
      else if (/precision/i.test(combinedText)) familyVal = 'Precision'
      else if (/elitebook/i.test(combinedText)) familyVal = 'EliteBook'
      else if (/probook/i.test(combinedText)) familyVal = 'ProBook'
      else if (/macbook pro/i.test(combinedText)) familyVal = 'MacBook Pro'
      else if (/macbook air/i.test(combinedText)) familyVal = 'MacBook Air'
      else if (/macbook/i.test(combinedText)) familyVal = 'MacBook'
      else if (/aspire/i.test(combinedText)) familyVal = 'Aspire'
      else if (/expertbook/i.test(combinedText)) familyVal = 'ExpertBook'
      else if (/zenbook/i.test(combinedText)) familyVal = 'ZenBook'
      else if (/vivobook/i.test(combinedText)) familyVal = 'VivoBook'
      else if (/galaxy book/i.test(combinedText)) familyVal = 'Galaxy Book'
      else {
        familyVal = (pModel || brandVal || title).trim().slice(0, 60)
      }

      let procBrand = 'Intel'
      let procLine = 'Core i7'
      let procModel = ''

      const procCombined = (pProcessor + ' ' + pName).toLowerCase()
      if (procCombined.includes('amd') || procCombined.includes('ryzen')) {
        procBrand = 'AMD'
        if (procCombined.includes('ryzen 7')) procLine = 'Ryzen 7'
        else if (procCombined.includes('ryzen 5')) procLine = 'Ryzen 5'
        else if (procCombined.includes('ryzen 3')) procLine = 'Ryzen 3'
        else if (procCombined.includes('ryzen 9')) procLine = 'Ryzen 9'
        else procLine = 'Ryzen'
      } else if (
        procCombined.includes('apple') ||
        procCombined.includes('m1') ||
        procCombined.includes('m2') ||
        procCombined.includes('m3')
      ) {
        procBrand = 'Apple'
        if (procCombined.includes('m3')) procLine = 'M3'
        else if (procCombined.includes('m2')) procLine = 'M2'
        else procLine = 'M1'
      } else {
        procBrand = 'Intel'
        if (procCombined.includes('i7') || procCombined.includes('core i7')) procLine = 'Core i7'
        else if (procCombined.includes('i5') || procCombined.includes('core i5'))
          procLine = 'Core i5'
        else if (procCombined.includes('i3') || procCombined.includes('core i3'))
          procLine = 'Core i3'
        else if (procCombined.includes('i9') || procCombined.includes('core i9'))
          procLine = 'Core i9'
        else if (procCombined.includes('celeron')) procLine = 'Celeron'
        else if (procCombined.includes('xeon')) procLine = 'Xeon'
      }

      const modelMatch = (pProcessor + ' ' + pName).match(/\b(\d{4}[A-Z0-9]*)\b/i)
      if (modelMatch && modelMatch[1]) {
        procModel = modelMatch[1].toUpperCase()
      } else {
        if (procLine === 'Core i7' && procCombined.includes('8')) {
          procModel = '8550U'
        } else if (procLine === 'Core i5' && procCombined.includes('8')) {
          procModel = '8250U'
        } else if (procLine === 'Core i7' && procCombined.includes('7')) {
          procModel = '7500U'
        } else if (procLine === 'Core i5' && procCombined.includes('7')) {
          procModel = '7200U'
        } else if (procLine === 'Core i7' && procCombined.includes('10')) {
          procModel = '10510U'
        } else if (procLine === 'Core i5' && procCombined.includes('10')) {
          procModel = '10210U'
        } else if (procLine === 'Core i7' && procCombined.includes('11')) {
          procModel = '1165G7'
        } else if (procLine === 'Core i5' && procCombined.includes('11')) {
          procModel = '1135G7'
        } else {
          procModel = pProcessor.trim() || '8250U'
        }
      }

      const attributesMap = {}
      function setAttr(id, valueName) {
        if (
          id &&
          valueName !== undefined &&
          valueName !== null &&
          String(valueName).trim() !== ''
        ) {
          attributesMap[id] = { id: id, value_name: String(valueName).trim() }
        }
      }

      if (brandVal) setAttr('BRAND', brandVal)
      if (modelVal) setAttr('MODEL', modelVal)
      if (familyVal) {
        setAttr('LINE', familyVal)
        setAttr('FAMILY_NAME', familyVal)
      }
      if (procBrand) setAttr('PROCESSOR_BRAND', procBrand)
      if (procLine) setAttr('PROCESSOR_LINE', procLine)
      if (procModel) setAttr('PROCESSOR_MODEL', procModel)

      if (pRam) {
        const ramMatch = pRam.match(/(\d+)\s*GB/i)
        if (ramMatch) {
          setAttr('RAM_MEMORY_MODULE_TOTAL_CAPACITY', ramMatch[1] + ' GB')
          setAttr('RAM', ramMatch[1] + ' GB')
        } else {
          setAttr('RAM', pRam)
        }
      }

      if (pStorage) {
        const ssdMatch = pStorage.match(/(\d+)\s*(GB|TB)/i)
        if (ssdMatch) {
          setAttr('SSD_DATA_STORAGE_CAPACITY', ssdMatch[1] + ' ' + ssdMatch[2].toUpperCase())
        }
      }

      if (pScreen) {
        setAttr('SCREEN_SIZE', pScreen)
      }

      if (product.getBool('has_numeric_keypad') !== undefined) {
        setAttr('WITH_NUMERIC_PAD', product.getBool('has_numeric_keypad') ? 'Sim' : 'Não')
      }

      if (mlCondition === 'refurbished' && gradeLabel) {
        setAttr('GRADING', gradeLabel)
        setAttr('ITEM_GRADE', gradeLabel)
      }

      const missingAttrs = []
      const friendlyNames = {
        BRAND: 'Marca (BRAND)',
        MODEL: 'Modelo (MODEL)',
        LINE: 'Linha/Família (LINE)',
        PROCESSOR_BRAND: 'Marca do Processador',
        PROCESSOR_LINE: 'Linha do Processador',
        PROCESSOR_MODEL: 'Modelo do Processador',
        RAM: 'Memória RAM',
        family_name: 'Família do Produto (family_name)',
      }

      for (const reqId in requiredAttrMap) {
        if (!attributesMap[reqId]) {
          const def = requiredAttrMap[reqId]
          const label = friendlyNames[reqId] || def.name || reqId
          missingAttrs.push(label)
        }
      }

      if (missingAttrs.length > 0) {
        const errText =
          'O Mercado Livre exige os seguintes atributos obrigatórios para a categoria ' +
          categoryId +
          ': ' +
          missingAttrs.join(', ') +
          '. Revise o cadastro do equipamento para preenchê-los.'
        pubItem.set('status', 'error')
        pubItem.set('error_message', errText)
        $app.save(pubItem)
        continue
      }

      const itemAttributes = []
      for (const k in attributesMap) {
        itemAttributes.push(attributesMap[k])
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
        family_name: familyVal || title.slice(0, 60),
        attributes: itemAttributes,
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

      if (
        createRes.statusCode >= 400 &&
        itemPayload.attributes &&
        itemPayload.attributes.length > 0
      ) {
        const errJsonTemp = createRes.json || {}
        const errMsgTemp = JSON.stringify(errJsonTemp).toLowerCase()
        if (
          errMsgTemp.includes('item_grade') ||
          errMsgTemp.includes('grading') ||
          errMsgTemp.includes('invalid_attribute')
        ) {
          console.log('[ml_cron] Ajustando atributos e retentando publicação...')
          itemPayload.attributes = itemPayload.attributes.filter(
            (a) => a.id !== 'ITEM_GRADE' && a.id !== 'GRADING',
          )
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
            console.log('[ml_cron] Erro ao retentar com atributos ajustados: ' + retryErr)
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
