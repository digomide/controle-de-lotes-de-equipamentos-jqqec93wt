// Worker cron de contingência para as filas do Mercado Livre
// Processa quaisquer itens que permanecerem com status 'pending'
// Suporta modelo moderno User Product do Mercado Livre (family_name na raiz e NÃO envia title)
// Suporta envio de GTIN / EMPTY_GTIN_REASON e registro amigável de erro para cause 7810
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

      // Extração robusta do campo JSON 'payload' no PocketBase v0.36 (Goja engine)
      let payload = {}
      try {
        let jsonString = ''
        if (typeof pubItem.getString === 'function') {
          jsonString = pubItem.getString('payload') || ''
        }
        if (!jsonString) {
          const rawPl = pubItem.get('payload')
          if (typeof rawPl === 'string') {
            jsonString = rawPl
          } else if (rawPl !== undefined && rawPl !== null) {
            jsonString = String(rawPl)
          }
        }

        if (jsonString && jsonString.trim()) {
          try {
            payload = JSON.parse(jsonString)
          } catch (parseErr) {
            console.log('[ml_cron] Erro ao parsear JSON do payload: ' + parseErr)
            payload = {}
          }
        }

        if (!payload || (!payload.title && !payload.family_name)) {
          try {
            const direct = pubItem.get('payload')
            if (direct && typeof direct === 'object' && (direct.title || direct.family_name)) {
              payload = direct
            }
          } catch (_) {}
        }
      } catch (err) {
        console.log('[ml_cron] Erro ao extrair payload: ' + err)
        payload = {}
      }

      // Título sugerido
      let rawTitleInput = ''
      let titleSource = 'product.name'
      if (payload && payload.title && typeof payload.title === 'string' && payload.title.trim()) {
        rawTitleInput = payload.title.trim()
        titleSource = 'payload.title'
      } else {
        rawTitleInput = (product.getString('name') || '').trim()
      }

      const cleanTitleOneLine = rawTitleInput
        .replace(/[\r\n\t]+/g, ' ')
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/\s+/g, ' ')
        .trim()
      const initialTitle = cleanTitleOneLine.slice(0, 60).trim()

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

      // 1. Obter metadados dos atributos da categoria
      let categoryAttributesMeta = []
      try {
        const headers = { Accept: 'application/json' }
        if (accessToken) headers['Authorization'] = 'Bearer ' + accessToken
        const catAttrRes = $http.send({
          url: 'https://api.mercadolibre.com/categories/' + categoryId + '/attributes',
          method: 'GET',
          headers: headers,
          timeout: 20,
        })
        if (catAttrRes.statusCode === 200 && Array.isArray(catAttrRes.json)) {
          categoryAttributesMeta = catAttrRes.json
        }
      } catch (cErr) {
        console.log(
          '[ml_cron] Erro ao consultar atributos da categoria ' + categoryId + ': ' + cErr,
        )
      }

      const categoryAttrLookup = {}
      for (let cIdx = 0; cIdx < categoryAttributesMeta.length; cIdx++) {
        const ca = categoryAttributesMeta[cIdx]
        if (ca && ca.id) {
          categoryAttrLookup[ca.id] = ca
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
        modelVal = initialTitle.replace(brandVal, '').trim() || pName.slice(0, 60)
      }

      // Linha / Família (LINE)
      let familyVal = ((payload && payload.family_name) || '').toString().trim()
      if (!familyVal) {
        const combinedText = (pModel + ' ' + pName).trim()
        if (/thinkpad/i.test(combinedText)) familyVal = 'ThinkPad'
        else if (/ideapad/i.test(combinedText)) familyVal = 'IdeaPad'
        else if (/legion/i.test(combinedText)) familyVal = 'Legion'
        else if (/yoga/i.test(combinedText)) familyVal = 'Yoga'
        else if (/latitude/i.test(combinedText)) familyVal = 'Latitude'
        else if (/inspiron/i.test(combinedText)) familyVal = 'Inspiron'
        else if (/vostro/i.test(combinedText)) familyVal = 'Vostro'
        else if (/precision/i.test(combinedText)) familyVal = 'Precision'
        else if (/xps/i.test(combinedText)) familyVal = 'XPS'
        else if (/alienware/i.test(combinedText)) familyVal = 'Alienware'
        else if (/macbook\s*pro/i.test(combinedText)) familyVal = 'MacBook Pro'
        else if (/macbook\s*air/i.test(combinedText)) familyVal = 'MacBook Air'
        else if (/macbook/i.test(combinedText)) familyVal = 'MacBook'
        else if (/imac/i.test(combinedText)) familyVal = 'iMac'
        else if (/elitebook/i.test(combinedText)) familyVal = 'EliteBook'
        else if (/probook/i.test(combinedText)) familyVal = 'ProBook'
        else if (/pavilion/i.test(combinedText)) familyVal = 'Pavilion'
        else if (/omen/i.test(combinedText)) familyVal = 'Omen'
        else if (/spectre/i.test(combinedText)) familyVal = 'Spectre'
        else if (/envy/i.test(combinedText)) familyVal = 'Envy'
        else if (/zbook/i.test(combinedText)) familyVal = 'ZBook'
        else if (/aspire/i.test(combinedText)) familyVal = 'Aspire'
        else if (/predator/i.test(combinedText)) familyVal = 'Predator'
        else if (/nitro/i.test(combinedText)) familyVal = 'Nitro'
        else if (/swift/i.test(combinedText)) familyVal = 'Swift'
        else if (/spin/i.test(combinedText)) familyVal = 'Spin'
        else if (/travelmate/i.test(combinedText)) familyVal = 'TravelMate'
        else if (/expertbook/i.test(combinedText)) familyVal = 'ExpertBook'
        else if (/zenbook/i.test(combinedText)) familyVal = 'ZenBook'
        else if (/vivobook/i.test(combinedText)) familyVal = 'VivoBook'
        else if (/\brog\b/i.test(combinedText)) familyVal = 'ROG'
        else if (/\btuf\b/i.test(combinedText)) familyVal = 'TUF'
        else if (/satellite/i.test(combinedText)) familyVal = 'Satellite'
        else if (/dynabook/i.test(combinedText)) familyVal = 'Dynabook'
        else if (/portege/i.test(combinedText)) familyVal = 'Portege'
        else if (/tecra/i.test(combinedText)) familyVal = 'Tecra'
        else if (/galaxy\s*book/i.test(combinedText)) familyVal = 'Galaxy Book'
        else if (/surface/i.test(combinedText)) familyVal = 'Surface'
        else if (/unique/i.test(combinedText)) familyVal = 'Unique'
        else if (/motion/i.test(combinedText)) familyVal = 'Motion'
        else if (/master/i.test(combinedText)) familyVal = 'Master'
        else if (/\bvaio\b/i.test(combinedText)) familyVal = 'VAIO'
        else if (pModel) {
          const firstWord = pModel.split(/[\s-]+/)[0]
          familyVal = (firstWord && firstWord.length >= 2 ? firstWord : pModel).slice(0, 60)
        } else {
          familyVal = (brandVal || initialTitle).trim().slice(0, 60)
        }
      }

      let fullFamilyName = familyVal
      if (brandVal && !fullFamilyName.toLowerCase().includes(brandVal.toLowerCase())) {
        fullFamilyName = brandVal + ' ' + fullFamilyName
      }
      if (modelVal && !fullFamilyName.toLowerCase().includes(modelVal.toLowerCase())) {
        fullFamilyName = fullFamilyName + ' ' + modelVal
      }
      fullFamilyName = fullFamilyName.slice(0, 60).trim()

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
        if (procLine === 'Core i7' && procCombined.includes('8')) procModel = '8550U'
        else if (procLine === 'Core i5' && procCombined.includes('8')) procModel = '8250U'
        else if (procLine === 'Core i7' && procCombined.includes('7')) procModel = '7500U'
        else if (procLine === 'Core i5' && procCombined.includes('7')) procModel = '7200U'
        else if (procLine === 'Core i7' && procCombined.includes('10')) procModel = '10510U'
        else if (procLine === 'Core i5' && procCombined.includes('10')) procModel = '10210U'
        else if (procLine === 'Core i7' && procCombined.includes('11')) procModel = '1165G7'
        else if (procLine === 'Core i5' && procCombined.includes('11')) procModel = '1135G7'
        else procModel = pProcessor.trim() || '8250U'
      }

      // RAM
      let ramVal = ''
      if (pRam) {
        const ramMatch = pRam.match(/(\d+)\s*GB/i)
        ramVal = ramMatch ? ramMatch[1] + ' GB' : pRam
      }

      // Storage
      let storageVal = ''
      let isHDStorage = false
      if (pStorage) {
        const storageUpper = pStorage.toUpperCase()
        const ssdMatch = pStorage.match(/(\d+)\s*(GB|TB)/i)
        if (ssdMatch) {
          storageVal = ssdMatch[1] + ' ' + ssdMatch[2].toUpperCase()
          isHDStorage = storageUpper.includes('HD') && !storageUpper.includes('SSD')
        }
      }

      // Tela
      let normalizedScreen = ''
      let rawScreenCandidate = pScreen
      if (!rawScreenCandidate) {
        const screenMatch = (initialTitle + ' ' + pName).match(
          /(\d{2}(?:\.\d)?)\s*(?:["”']|pol|polegadas)?/i,
        )
        if (screenMatch && screenMatch[1]) {
          const numVal = parseFloat(screenMatch[1])
          if (numVal >= 10 && numVal <= 21) {
            rawScreenCandidate = screenMatch[1]
          }
        }
      }
      if (rawScreenCandidate) {
        const numOnly = rawScreenCandidate.replace(/[^0-9.]/g, '')
        normalizedScreen = numOnly ? numOnly + ' "' : rawScreenCandidate
      }

      const hasNumPad = product.getBool('has_numeric_keypad')

      // Extração do GTIN/EAN informado pelo usuário
      let rawGtin = ((payload && payload.gtin) || product.getString('gtin') || '').trim()
      let userGtin = ''
      if (/^\d{8,14}$/.test(rawGtin)) {
        userGtin = rawGtin
      }

      function buildAttributes(mode, cond, gtinValue, useExemption) {
        const m = {}
        function add(id, valName) {
          if (!id || valName === undefined || valName === null) return
          const s = String(valName).trim()
          if (!s) return
          const def = categoryAttrLookup[id]
          if (def) {
            if (def.tags && (def.tags.read_only === true || def.tags.hidden === true)) return
            if (Array.isArray(def.values) && def.values.length > 0) {
              const l = s.toLowerCase()
              for (let vi = 0; vi < def.values.length; vi++) {
                const v = def.values[vi]
                if ((v.name && v.name.toLowerCase() === l) || (v.id && String(v.id) === s)) {
                  m[id] = { id: id, value_id: String(v.id), value_name: v.name }
                  return
                }
              }
            }
          }
          m[id] = { id: id, value_name: s }
        }

        if (brandVal) add('BRAND', brandVal)
        if (modelVal) add('MODEL', modelVal)
        if (familyVal) add('LINE', familyVal)
        if (procBrand) add('PROCESSOR_BRAND', procBrand)
        if (procLine) add('PROCESSOR_LINE', procLine)
        if (procModel) add('PROCESSOR_MODEL', procModel)

        if (cond === 'refurbished' && gradeLabel) {
          const gradingValueMap = {
            excelente: { value_id: '40108830', value_name: 'Excelente' },
            bom: { value_id: '40108831', value_name: 'Bom' },
            aceitavel: { value_id: '40108832', value_name: 'Aceitável' },
          }
          const mapped = gradingValueMap[rawGrade] || {
            value_id: '40108830',
            value_name: 'Excelente',
          }
          m['GRADING'] = {
            id: 'GRADING',
            value_id: mapped.value_id,
            value_name: mapped.value_name,
          }
        }

        // GTIN ou isenção
        if (gtinValue) {
          m['GTIN'] = { id: 'GTIN', value_name: gtinValue }
        } else if (useExemption) {
          m['EMPTY_GTIN_REASON'] = { id: 'EMPTY_GTIN_REASON', value_name: 'Outro motivo' }
        }

        if (mode === 'full') {
          if (ramVal) add('RAM_MEMORY_MODULE_TOTAL_CAPACITY', ramVal)
          if (storageVal) {
            if (isHDStorage) add('HARD_DRIVE_DATA_STORAGE_CAPACITY', storageVal)
            else add('SSD_DATA_STORAGE_CAPACITY', storageVal)
          }
          if (normalizedScreen) {
            if (categoryAttrLookup['DISPLAY_SIZE']) add('DISPLAY_SIZE', normalizedScreen)
            else if (categoryAttrLookup['SCREEN_SIZE']) add('SCREEN_SIZE', normalizedScreen)
            else add('DISPLAY_SIZE', normalizedScreen)
          }
          if (hasNumPad !== undefined) {
            m['WITH_NUMERIC_PAD'] = {
              id: 'WITH_NUMERIC_PAD',
              value_id: hasNumPad ? '242085' : '242084',
              value_name: hasNumPad ? 'Sim' : 'Não',
            }
          }
        }

        const arr = []
        for (const k in m) {
          arr.push(m[k])
        }
        return arr
      }

      const defaultSaleTerms = [
        { id: 'WARRANTY_TYPE', value_name: 'Garantia do vendedor' },
        { id: 'WARRANTY_TIME', value_name: '90 dias' },
      ]

      // Lista de variações User Product (NÃO envia title; envia family_name na raiz)
      const variations = []
      if (userGtin) {
        // Usuário informou GTIN real: testar prioritariamente com ele
        variations.push({
          name: 'UP (User Product: SEM title, GTIN informado, full)',
          sendTitle: false,
          familyName: fullFamilyName || 'Notebook ' + (familyVal || brandVal),
          attrMode: 'full',
          gtin: userGtin,
          useExemption: false,
          condition: mlCondition,
          includeWarranty: true,
        })
        variations.push({
          name: 'UP (User Product: SEM title, family curta, GTIN informado, minimal)',
          sendTitle: false,
          familyName: familyVal || 'ThinkPad',
          attrMode: 'minimal',
          gtin: userGtin,
          useExemption: false,
          condition: mlCondition,
          includeWarranty: true,
        })
      } else {
        // Sem GTIN: tentar isenção primeiro, depois sem atributo GTIN
        variations.push({
          name: 'UP (User Product: SEM title, com isenção EMPTY_GTIN_REASON)',
          sendTitle: false,
          familyName: fullFamilyName || 'Notebook ' + (familyVal || brandVal),
          attrMode: 'full',
          gtin: null,
          useExemption: true,
          condition: mlCondition,
          includeWarranty: true,
        })
        variations.push({
          name: 'UP (User Product: SEM title, sem GTIN)',
          sendTitle: false,
          familyName: fullFamilyName || 'Notebook ' + (familyVal || brandVal),
          attrMode: 'full',
          gtin: null,
          useExemption: false,
          condition: mlCondition,
          includeWarranty: true,
        })
      }

      let successfulRes = null
      let successfulVariation = null
      let lastResponse = null
      let gtinRequiredBlocked = false

      for (let vIdx = 0; vIdx < variations.length; vIdx++) {
        const v = variations[vIdx]
        const itemAttrs = buildAttributes(v.attrMode, v.condition, v.gtin, v.useExemption)

        const trialPayload = {
          category_id: categoryId,
          price: price,
          currency_id: 'BRL',
          available_quantity: 1,
          buying_mode: 'buy_it_now',
          listing_type_id: listingTypeId,
          condition: v.condition,
          pictures: pictureObjects,
          channels: ['marketplace'],
          attributes: itemAttrs,
          family_name: v.familyName,
        }

        if (v.sendTitle && v.title) {
          trialPayload.title = v.title
        }
        if (v.includeWarranty) {
          trialPayload.sale_terms = defaultSaleTerms
        }

        let trialRes = null
        try {
          trialRes = $http.send({
            url: 'https://api.mercadolibre.com/items',
            method: 'POST',
            headers: {
              Authorization: 'Bearer ' + accessToken,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify(trialPayload),
            timeout: 30,
          })
        } catch (netErr) {
          console.log('[ml_cron] Erro de rede: ' + netErr)
          continue
        }

        lastResponse = trialRes.json || {}

        // Checar se o ML recusou exigindo especificamente GTIN (cause 7810 / missing_conditional_required)
        const respStr = JSON.stringify(lastResponse)
        if (respStr.includes('missing_conditional_required') && respStr.includes('GTIN')) {
          gtinRequiredBlocked = true
          console.log('[ml_cron] Categoria exige GTIN/EAN de fábrica obrigatório.')
          break
        }

        if (
          trialRes.statusCode === 201 ||
          (trialRes.statusCode >= 200 && trialRes.statusCode < 300)
        ) {
          successfulRes = trialRes
          successfulVariation = v
          break
        }
      }

      if (successfulRes && successfulVariation) {
        const createdItem = successfulRes.json || {}
        const itemId = createdItem.id || ''
        const permalink = createdItem.permalink || ''
        const itemStatus = createdItem.status || 'active'

        // Sanitizar descrição
        let sanitizedDescription = customDescription || ''
        if (sanitizedDescription) {
          sanitizedDescription = sanitizedDescription
            .replace(/\(?(?:0?[1-9]{2}\)?\s*)?(?:9\s*)?\d{4}[-\s]?\d{4}/g, '')
            .replace(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, '')
            .replace(/wa\.me\/[0-9]+/gi, '')
            .replace(/https?:\/\/[^\s]+/gi, '')
            .replace(/\b(?:whatsapp|zap|wpp|telefone|celular|contato|fone)\b[^\n]*/gi, '')
            .replace(/\bAMbicorpFlow\b/gi, '')
            .replace(/\bAMbicorp\b/gi, '')
            .replace(/segunda\s*a\s*sexta[^\n]*/gi, '')
            .replace(/atendimento[^\n]*/gi, '')
            .replace(/belo\s*horizonte(?:(?:\s*-\s*|\s*\/|\s*)mg)?/gi, '')
            .replace(/lote[s]?\s*(?:de\s*)?origem[^\n]*/gi, '')
            .replace(/proced[êe]ncia[^\n]*/gi, '')
            .replace(/origem\s*corporativa[^\n]*/gi, '')
            .replace(/leil[ãa]o[^\n]*/gi, '')
            .split('\n')
            .map((l) => l.trim())
            .filter((l, idx, arr) => {
              if (l === '' && idx > 0 && arr[idx - 1] === '') return false
              return true
            })
            .join('\n')
            .trim()
        }

        if (itemId && sanitizedDescription) {
          try {
            $http.send({
              url: 'https://api.mercadolibre.com/items/' + itemId + '/description',
              method: 'POST',
              headers: {
                Authorization: 'Bearer ' + accessToken,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ plain_text: sanitizedDescription }),
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
        if (userGtin && !product.getString('gtin')) {
          product.set('gtin', userGtin)
        }

        const currentEvents = product.get('history_events') || []
        const eventsList = Array.isArray(currentEvents) ? [...currentEvents] : []
        eventsList.push({
          title: 'Anunciado no Mercado Livre (' + itemId + ') - ' + successfulVariation.name,
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
          successful_variation: successfulVariation.name,
        })
        $app.save(pubItem)
        console.log('[ml_cron] Anúncio publicado com sucesso: ' + itemId)
      } else {
        let detailedMsg = ''
        if (gtinRequiredBlocked) {
          detailedMsg =
            "O Mercado Livre exige o código de barras de fábrica (GTIN/EAN) deste equipamento. Cole o código no campo 'Código de barras (GTIN/EAN)' do modal."
        } else if (lastResponse) {
          if (
            lastResponse.cause &&
            Array.isArray(lastResponse.cause) &&
            lastResponse.cause.length > 0
          ) {
            const causes = lastResponse.cause
              .map((c) => {
                const f = c.field || c.department || ''
                const m = c.message || c.code || JSON.stringify(c)
                return f ? f + ': ' + m : m
              })
              .join('; ')
            detailedMsg =
              (lastResponse.message || lastResponse.error || 'Erro de validação') + ' — ' + causes
          } else {
            detailedMsg =
              lastResponse.error_description ||
              lastResponse.message ||
              lastResponse.error ||
              'Nenhuma das variações de payload foi aceita pelo Mercado Livre.'
          }
        } else {
          detailedMsg = 'Falha ao comunicar com a API do Mercado Livre.'
        }

        pubItem.set('status', 'error')
        pubItem.set('error_message', detailedMsg)
        pubItem.set('result', {
          all_failed: true,
          last_error: lastResponse,
        })
        $app.save(pubItem)
      }
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
