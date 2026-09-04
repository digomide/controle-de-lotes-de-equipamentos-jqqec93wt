// Hook acionado imediatamente após a criação de um registro em ml_publish_queue
// Garante token válido, consulta atributos obrigatórios da categoria no ML, monta payload com attributes e family_name, e publica anúncio no Mercado Livre
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
      '[ml_publish_hook] Erro ao consultar atributos da categoria ' + categoryId + ': ' + cErr,
    )
  }

  // Identificar atributos obrigatórios da categoria
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

  // Extração e normalização dos dados do equipamento
  const pBrand = (product.getString('brand') || '').trim()
  const pModel = (product.getString('model') || '').trim()
  const pProcessor = (product.getString('processor') || '').trim()
  const pRam = (product.getString('ram') || '').trim()
  const pStorage = (product.getString('storage') || '').trim()
  const pScreen = (product.getString('screen_size') || '').trim()
  const pName = (product.getString('name') || '').trim()

  // 1. Marca (BRAND)
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

  // 2. Modelo (MODEL)
  let modelVal = pModel
  if (!modelVal) {
    modelVal = title.replace(brandVal, '').trim() || pName.slice(0, 60)
  }

  // 3. Família / Linha (LINE / family_name)
  // Ex: "ThinkPad T580" -> família "ThinkPad", ou "Latitude 5320" -> "Latitude", "MacBook Pro" -> "MacBook Pro"
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

  // 4. Processador (PROCESSOR_BRAND, PROCESSOR_LINE, PROCESSOR_MODEL)
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
    else if (procCombined.includes('i5') || procCombined.includes('core i5')) procLine = 'Core i5'
    else if (procCombined.includes('i3') || procCombined.includes('core i3')) procLine = 'Core i3'
    else if (procCombined.includes('i9') || procCombined.includes('core i9')) procLine = 'Core i9'
    else if (procCombined.includes('celeron')) procLine = 'Celeron'
    else if (procCombined.includes('xeon')) procLine = 'Xeon'
  }

  // Tentar extrair o modelo do processador (ex: "8550U", "8650U", "8250U", "i7-8650U" etc.)
  const modelMatch = (pProcessor + ' ' + pName).match(/\b(\d{4}[A-Z0-9]*)\b/i)
  if (modelMatch && modelMatch[1]) {
    procModel = modelMatch[1].toUpperCase()
  } else {
    // Se for 8ª geração i7 ex: 8550U / 8650U
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

  // 5. Montagem estruturada do array attributes
  const attributesMap = {}

  function setAttr(id, valueName) {
    if (id && valueName !== undefined && valueName !== null && String(valueName).trim() !== '') {
      attributesMap[id] = { id: id, value_name: String(valueName).trim() }
    }
  }

  // Atributos fundamentais
  if (brandVal) setAttr('BRAND', brandVal)
  if (modelVal) setAttr('MODEL', modelVal)
  if (familyVal) {
    setAttr('LINE', familyVal)
    setAttr('FAMILY_NAME', familyVal)
  }
  if (procBrand) setAttr('PROCESSOR_BRAND', procBrand)
  if (procLine) setAttr('PROCESSOR_LINE', procLine)
  if (procModel) setAttr('PROCESSOR_MODEL', procModel)

  // RAM
  if (pRam) {
    const ramMatch = pRam.match(/(\d+)\s*GB/i)
    if (ramMatch) {
      setAttr('RAM_MEMORY_MODULE_TOTAL_CAPACITY', ramMatch[1] + ' GB')
      setAttr('RAM', ramMatch[1] + ' GB')
    } else {
      setAttr('RAM', pRam)
    }
  }

  // Storage / SSD
  if (pStorage) {
    const ssdMatch = pStorage.match(/(\d+)\s*(GB|TB)/i)
    if (ssdMatch) {
      setAttr('SSD_DATA_STORAGE_CAPACITY', ssdMatch[1] + ' ' + ssdMatch[2].toUpperCase())
    }
  }

  // Tela
  if (pScreen) {
    setAttr('SCREEN_SIZE', pScreen)
  }

  // Teclado numérico
  if (product.getBool('has_numeric_keypad') !== undefined) {
    setAttr('WITH_NUMERIC_PAD', product.getBool('has_numeric_keypad') ? 'Sim' : 'Não')
  }

  // Grau para recondicionado
  if (mlCondition === 'refurbished' && gradeLabel) {
    setAttr('GRADING', gradeLabel)
    setAttr('ITEM_GRADE', gradeLabel)
  }

  // Validação: checar se algum atributo com required=true ficou faltando
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
    e.next()
    return
  }

  // Converter attributesMap em array
  const itemAttributes = []
  for (const k in attributesMap) {
    itemAttributes.push(attributesMap[k])
  }

  // Montar payload com attributes e campos topo-de-nível (incluindo family_name para compatibilidade com o novo modelo)
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
    e.next()
    return
  }

  // Se falhar por erro de atributo específico (ex: GRADING ou ITEM_GRADE rejeitado em não-recondicionados), retentar sanitizado
  if (createRes.statusCode >= 400 && itemPayload.attributes && itemPayload.attributes.length > 0) {
    const errJsonTemp = createRes.json || {}
    const errMsgTemp = JSON.stringify(errJsonTemp).toLowerCase()
    if (
      errMsgTemp.includes('item_grade') ||
      errMsgTemp.includes('grading') ||
      errMsgTemp.includes('invalid_attribute')
    ) {
      console.log('[ml_publish_hook] Ajustando atributos e retentando publicação...')
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
        console.log('[ml_publish_hook] Erro ao retentar com atributos ajustados: ' + retryErr)
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
