// Hook acionado imediatamente após a criação de um registro em ml_ads_fetch_jobs
// Executa a busca de anúncios na API oficial do Mercado Livre via $http.send
// Implementa:
// 1. Paginação profunda por status (active, paused, closed) com busca dedicada por status para
//    garantir que todos os anúncios ativos sempre sejam encontrados e priorizados.
// 2. Coleta paginada completa com limite seguro (até 2000 itens) e deduplicação por ID (MLB...).
// 3. Atualização contínua de progress_text no registro para feedback em tempo real na interface do usuário.
// 4. Multiget dos detalhes em lotes de 20 com campos compactos e GTIN.
// 5. Persistência resiliente com estratégia de degradação graciosa caso o payload seja grande,
//    evitando erros de gravação ("Failed to create/update record").

onRecordAfterCreateSuccess((e) => {
  const job = e.record
  if (!job || job.getString('status') !== 'pending') {
    e.next()
    return
  }

  job.set('status', 'processing')
  job.set('progress_text', 'Iniciando consulta aos anúncios do Mercado Livre...')
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
    job.set('progress_text', 'Erro: Mercado Livre não configurado.')
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
    job.set('progress_text', 'Erro: Conta do Mercado Livre não conectada.')
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

  // 3. Montar estratégia de busca paginada com suporte a status
  const requestedStatusFilter = (job.getString('status_filter') || '').trim()

  // Se o usuário solicitou um status específico (ex: 'active', 'paused', 'closed'), busca apenas ele.
  // Se for vazio ou 'all', buscamos por status separadamente ('active', 'paused', 'closed')
  // para garantir que os anúncios ATIVOS nunca fiquem para trás em contas com muitos anúncios pausados/antigos.
  const statusQueue = requestedStatusFilter
    ? [requestedStatusFilter]
    : ['active', 'paused', 'closed']

  const allItemIds = []
  const seenMlbIds = {}
  let totalAnnouncedGlobal = 0
  const statusStats = { active: 0, paused: 0, closed: 0 }
  const PAGE_LIMIT = 50
  const MAX_GLOBAL_CAP = 2000
  const MAX_PAGES_PER_STATUS = 25

  console.log(
    '[ml_ads_fetch_job] Iniciando busca paginada para seller ' +
      userIdMl +
      ' (status a consultar: ' +
      statusQueue.join(', ') +
      ')',
  )

  for (let sIdx = 0; sIdx < statusQueue.length; sIdx++) {
    const currentStatus = statusQueue[sIdx]
    let offset = 0
    let pageNum = 0
    let statusTotal = null

    const statusLabel =
      currentStatus === 'active'
        ? 'ativos'
        : currentStatus === 'paused'
          ? 'pausados'
          : currentStatus === 'closed'
            ? 'encerrados'
            : currentStatus

    while (pageNum < MAX_PAGES_PER_STATUS && allItemIds.length < MAX_GLOBAL_CAP) {
      pageNum++
      let searchUrl =
        'https://api.mercadolibre.com/users/' + userIdMl + '/items/search?limit=' + PAGE_LIMIT

      if (offset > 0) {
        searchUrl += '&offset=' + offset
      }
      if (currentStatus) {
        searchUrl += '&status=' + encodeURIComponent(currentStatus)
      }

      try {
        const progressMsg =
          'Buscando anúncios ' +
          statusLabel +
          ' (página ' +
          pageNum +
          (allItemIds.length > 0 ? ', ' + allItemIds.length + ' encontrados' : '') +
          ')...'
        job.set('progress_text', progressMsg)
        $app.save(job)
      } catch (_) {}

      console.log('[ml_ads_fetch_job] GET: ' + searchUrl)

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
        job.set('progress_text', 'Falha de comunicação com o Mercado Livre.')
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
        job.set('progress_text', 'Sessão do Mercado Livre expirada.')
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
        console.log(
          '[ml_ads_fetch_job] Erro retornado pela API (' + searchRes.statusCode + '): ' + errMsg,
        )

        // Se o status closed der erro ou não tiver suporte, prossegue para os outros status
        if (currentStatus === 'closed' || currentStatus === 'under_review') {
          break
        }

        job.set('status', 'error')
        job.set('status_code', searchRes.statusCode)
        job.set('error_message', errMsg)
        job.set('progress_text', 'Erro: ' + errMsg)
        $app.save(job)
        e.next()
        return
      }

      const searchData = searchRes.json || {}
      const results = Array.isArray(searchData.results) ? searchData.results : []
      const paging = searchData.paging || {}

      if (typeof paging.total === 'number') {
        statusTotal = paging.total
        totalAnnouncedGlobal = Math.max(totalAnnouncedGlobal, paging.total)
      }

      console.log(
        '[ml_ads_fetch_job] [' +
          currentStatus +
          '] Página ' +
          pageNum +
          ': ' +
          results.length +
          ' IDs retornados (total deste status: ' +
          (statusTotal !== null ? statusTotal : 'desconhecido') +
          ')',
      )

      if (results.length === 0) {
        break
      }

      let newCount = 0
      for (let r = 0; r < results.length; r++) {
        const id = results[r]
        if (id && !seenMlbIds[id]) {
          seenMlbIds[id] = true
          allItemIds.push(id)
          newCount++
        }
      }

      if (results.length < PAGE_LIMIT) {
        break
      }

      offset += results.length
      if (statusTotal !== null && offset >= statusTotal) {
        break
      }

      if (newCount === 0) {
        // Nenhuma novidade recebida nesta página, evitar loop
        break
      }
    }
  }

  console.log(
    '[ml_ads_fetch_job] Coleta de IDs concluída. Total único de anúncios encontrados: ' +
      allItemIds.length,
  )

  if (allItemIds.length === 0) {
    job.set('status', 'done')
    job.set('status_code', 200)
    job.set('seller_id', userIdMl)
    job.set('seller_nickname', nickname)
    job.set('items_count', 0)
    job.set('paging', { total: 0, offset: 0, limit: 0 })
    job.set('items', [])
    job.set('error_message', '')
    job.set('progress_text', 'Nenhum anúncio encontrado na conta.')
    $app.save(job)
    console.log('[ml_ads_fetch_job] Concluído: 0 itens encontrados.')
    e.next()
    return
  }

  // 4. Detalhes dos itens via multiget: GET /items?ids=MLB1,MLB2,...
  // O Mercado Livre permite até 20 IDs por multiget no /items?ids=
  const detailedItems = []
  const batchSize = 20
  const totalBatches = Math.ceil(allItemIds.length / batchSize)

  for (let i = 0; i < allItemIds.length; i += batchSize) {
    const batchIndex = Math.floor(i / batchSize) + 1
    const slice = allItemIds.slice(i, i + batchSize)
    const multigetUrl =
      'https://api.mercadolibre.com/items?ids=' +
      slice.join(',') +
      '&attributes=id,title,price,currency_id,available_quantity,sold_quantity,condition,status,permalink,thumbnail,pictures,attributes,date_created,last_updated,listing_type_id,catalog_product_id,catalog_listing,domain_id'

    try {
      const progressMsg =
        'Carregando detalhes dos anúncios (lote ' +
        batchIndex +
        ' de ' +
        totalBatches +
        ' — ' +
        detailedItems.length +
        '/' +
        allItemIds.length +
        ')...'
      job.set('progress_text', progressMsg)
      $app.save(job)
    } catch (_) {}

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
            let conditionGrade = ''
            let isRefurbishedAttr = false

            if (Array.isArray(body.attributes)) {
              for (let a = 0; a < body.attributes.length; a++) {
                const attr = body.attributes[a]
                const attrId = (attr.id || '').toUpperCase()
                const attrName = (attr.name || '').toLowerCase()

                if (attrId === 'GTIN') gtin = attr.value_name || ''
                if (attrId === 'BRAND') brand = attr.value_name || ''
                if (attrId === 'MODEL') model = attr.value_name || ''
                if (attrId === 'LINE') line = attr.value_name || ''

                // Atributo oficial de Grau/Status do Recondicionado do ML
                if (
                  attrId === 'GRADING' ||
                  attrId === 'RECONDITIONED_STATUS' ||
                  attrId === 'REFURBISHED_STATUS' ||
                  attrName.includes('recondicionado')
                ) {
                  if (attr.value_name) {
                    conditionGrade = attr.value_name
                    isRefurbishedAttr = true
                  }
                }
              }
            }

            // Resolução da condição e do status de recondicionado
            // 1) Se a condição raiz do ML for 'refurbished'
            // 2) OU se houver atributo GRADING ("Status do recondicionado")
            // 3) OU se o título indicar explicitamente Recondicionado
            let resolvedCondition = body.condition || 'new'
            const titleUpper = (body.title || '').toUpperCase()
            if (
              resolvedCondition === 'refurbished' ||
              isRefurbishedAttr ||
              titleUpper.includes('RECONDICIONADO')
            ) {
              resolvedCondition = 'refurbished'
            }

            // Tentar extrair o grau do título caso não esteja preenchido pelo atributo GRADING
            if (resolvedCondition === 'refurbished' && !conditionGrade) {
              if (titleUpper.includes('EXCELENTE')) {
                conditionGrade = 'Excelente'
              } else if (titleUpper.includes('BOM')) {
                conditionGrade = 'Bom'
              } else if (titleUpper.includes('ACEITÁVEL') || titleUpper.includes('ACEITAVEL')) {
                conditionGrade = 'Aceitável'
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
              condition: resolvedCondition,
              condition_grade: conditionGrade || undefined,
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

  // 5. Contar estatísticas por status dos itens coletados e ordenação amigável: Ativos primeiro, depois pausados, depois encerrados
  const statusWeight = { active: 1, paused: 2, closed: 3 }
  detailedItems.forEach(function (it) {
    if (it.status === 'active') statusStats.active++
    else if (it.status === 'paused') statusStats.paused++
    else if (it.status === 'closed') statusStats.closed++
  })

  detailedItems.sort(function (a, b) {
    const wa = statusWeight[a.status] || 9
    const wb = statusWeight[b.status] || 9
    if (wa !== wb) return wa - wb
    const da = a.last_updated || a.date_created || ''
    const db = b.last_updated || b.date_created || ''
    return db.localeCompare(da)
  })

  // 6. Sanitização para não estourar limite do registro no SQLite
  function sanitizeItems(items, level) {
    return items.map(function (it) {
      const base = {
        id: it.id,
        title: (it.title || '').substring(0, 140),
        price: it.price,
        currency_id: it.currency_id || 'BRL',
        available_quantity: it.available_quantity,
        sold_quantity: it.sold_quantity || 0,
        condition: it.condition,
        status: it.status,
        permalink: it.permalink,
        thumbnail: it.thumbnail,
        pictures_count: it.pictures_count || 0,
        listing_type_id: it.listing_type_id,
        date_created: it.date_created,
        last_updated: it.last_updated,
        gtin: it.gtin,
        catalog_product_id: it.catalog_product_id,
        catalog_listing: it.catalog_listing,
        domain_id: it.domain_id,
      }
      if (it.condition_grade) {
        base.condition_grade = it.condition_grade
      }
      if (level === 1) {
        base.brand = it.brand
        base.model = it.model
        base.line = it.line
      }
      return base
    })
  }

  const pagingPayload = {
    total: detailedItems.length,
    offset: 0,
    limit: detailedItems.length,
    total_announced: totalAnnouncedGlobal,
  }

  // Formato exigido: "Ativos: X, Pausados: Y, Encerrados: Z"
  const finalProgressText =
    'Ativos: ' +
    statusStats.active +
    ', Pausados: ' +
    statusStats.paused +
    ', Encerrados: ' +
    statusStats.closed +
    ' (' +
    detailedItems.length +
    ' anúncios carregados com sucesso' +
    (totalAnnouncedGlobal > detailedItems.length ? ' de ~' + totalAnnouncedGlobal : '') +
    ').'

  let saveSuccess = false
  let currentPayload = sanitizeItems(detailedItems, 1)
  let attempt = 1

  while (!saveSuccess && attempt <= 4) {
    try {
      job.set('status', 'done')
      job.set('status_code', 200)
      job.set('seller_id', userIdMl)
      job.set('seller_nickname', nickname)
      job.set('items_count', detailedItems.length)
      job.set('paging', pagingPayload)
      job.set('items', currentPayload)
      job.set('error_message', '')
      job.set('progress_text', finalProgressText)
      $app.save(job)
      saveSuccess = true
    } catch (saveErr) {
      attempt++
      console.log(
        '[ml_ads_fetch_job] Falha ao persistir payload (tentativa ' +
          (attempt - 1) +
          '): ' +
          saveErr,
      )
      if (attempt === 2) {
        // Fallback 1: remover brand, model, line secundários
        currentPayload = sanitizeItems(detailedItems, 2)
      } else if (attempt === 3) {
        // Fallback 2: limitar a 800 itens sanitizados
        currentPayload = sanitizeItems(detailedItems.slice(0, 800), 2)
        job.set('items_count', currentPayload.length)
      } else if (attempt === 4) {
        // Fallback 3: limitar a 400 itens ultra-enxutos
        currentPayload = sanitizeItems(detailedItems.slice(0, 400), 2)
        job.set('items_count', currentPayload.length)
      }
    }
  }

  if (!saveSuccess) {
    job.set('status', 'error')
    job.set('status_code', 500)
    job.set('error_message', 'Excedido limite de tamanho ao salvar anúncios no banco de dados.')
    job.set('progress_text', 'Falha ao salvar anúncios no banco de dados.')
    job.set('items', [])
    $app.save(job)
  } else {
    console.log(
      '[ml_ads_fetch_job] Busca concluída com sucesso! Total de itens carregados: ' +
        detailedItems.length,
    )
  }

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
