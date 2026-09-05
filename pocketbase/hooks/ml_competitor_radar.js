// Hook para processamento assíncrono da fila de jobs de concorrentes ML (ml_competitor_jobs)
// Ações suportadas:
// - 'resolve_from_item': extrai seller_id do anúncio via GET /items?ids=MLB..., cria/atualiza ml_competitors, salva anúncio(s) em ml_competitor_ads, cria ml_price_history inicial e evento de novo anúncio.
// - 'resolve_competitor': busca o seller_id e dados a partir de busca textual pública (avisa 403 se restrito)
// - 'sync_competitor': consulta /items?ids=... para todos os anúncios monitorados do concorrente (ou target especificado), atualiza ml_competitor_ads, gera ml_price_history e ml_competitor_events
// - 'sync_all': varre todos os anúncios de concorrentes ativos via /items?ids=... em lotes e sincroniza mudanças
// - 'search_query': busca anúncios concorrentes no ML pelo termo de busca

onRecordAfterCreateSuccess((e) => {
  const job = e.record
  if (!job || job.getString('status') !== 'pending') {
    e.next()
    return
  }

  job.set('status', 'processing')
  $app.save(job)

  let accessToken = ''
  try {
    const sRecords = $app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (sRecords && sRecords.length > 0) {
      accessToken = (sRecords[0].getString('access_token') || '').trim()
    }
  } catch (_) {}

  const action = job.getString('action')
  const query = (job.getString('query') || '').trim()
  const targetSellerId = (job.getString('seller_id') || '').trim()

  console.log('[ml_competitor_jobs] Executando job ' + job.id + ' acao: ' + action)

  try {
    // -------------------------------------------------------------------------
    // 1. RESOLVE FROM ITEM (Novo fluxo robusto via ID ou links de anúncios MLB)
    // -------------------------------------------------------------------------
    if (action === 'resolve_from_item') {
      // Extrair IDs MLB da query ou result_data.item_ids
      // O input pode conter múltiplos links ou IDs separados por quebra de linha, espaço, vírgula, ponto-e-vírgula
      let rawInput = query
      let parsedIds = []

      // Se passou array em result_data antes
      try {
        const rd = job.get('result_data')
        if (rd && Array.isArray(rd.item_ids)) {
          parsedIds = rd.item_ids
        }
      } catch (_) {}

      if (parsedIds.length === 0 && rawInput) {
        // Regex para capturar MLB com ou sem hífen: MLB1234567890 ou MLB-1234567890
        const matches = rawInput.match(/MLB-?[0-9]{8,14}/gi)
        if (matches && matches.length > 0) {
          const seen = {}
          for (let m = 0; m < matches.length; m++) {
            const cleanMlb = matches[m].toUpperCase().replace('-', '')
            if (!seen[cleanMlb]) {
              seen[cleanMlb] = true
              parsedIds.push(cleanMlb)
            }
          }
        }
      }

      if (parsedIds.length === 0) {
        job.set('status', 'error')
        job.set('status_code', 400)
        job.set(
          'error_message',
          'Nenhum código MLB válido encontrado no link ou texto informado. Exemplo esperado: MLB1234567890 ou link de produto do Mercado Livre.',
        )
        $app.save(job)
        e.next()
        return
      }

      console.log(
        '[ml_competitor_jobs] resolve_from_item com ' +
          parsedIds.length +
          ' item(s): ' +
          parsedIds.join(','),
      )

      // Consultar endpoint multiget /items?ids=MLB1,MLB2,...
      const headers = { Accept: 'application/json' }
      if (accessToken) headers['Authorization'] = 'Bearer ' + accessToken

      // ML aceita até 20 IDs por requisição multiget
      const chunkSize = 20
      const fetchedItems = []

      for (let i = 0; i < parsedIds.length; i += chunkSize) {
        const chunk = parsedIds.slice(i, i + chunkSize)
        const itemsUrl = 'https://api.mercadolibre.com/items?ids=' + chunk.join(',')
        const res = $http.send({
          url: itemsUrl,
          method: 'GET',
          headers: headers,
          timeout: 25,
        })

        if (res.statusCode >= 400) {
          console.log('[ml_competitor_jobs] Erro no multiget /items: HTTP ' + res.statusCode)
          continue
        }

        const list = Array.isArray(res.json) ? res.json : []
        for (let j = 0; j < list.length; j++) {
          const entry = list[j]
          if (entry && entry.code === 200 && entry.body) {
            fetchedItems.push(entry.body)
          } else {
            console.log(
              '[ml_competitor_jobs] Item individual retornou status ' +
                (entry ? entry.code : 'desconhecido') +
                ' para ' +
                (chunk[j] || ''),
            )
          }
        }
      }

      if (fetchedItems.length === 0) {
        job.set('status', 'error')
        job.set('status_code', 404)
        job.set(
          'error_message',
          'Nenhum dos anúncios pôde ser consultado no Mercado Livre. Verifique se os links ou códigos MLB estão corretos.',
        )
        $app.save(job)
        e.next()
        return
      }

      // O seller do primeiro item resolve o concorrente principal
      const primaryItem = fetchedItems[0]
      const primarySellerId = String(primaryItem.seller_id || '')

      if (!primarySellerId) {
        job.set('status', 'error')
        job.set('status_code', 400)
        job.set('error_message', 'Não foi possível identificar o vendedor deste anúncio.')
        $app.save(job)
        e.next()
        return
      }

      // Buscar nickname do vendedor via GET /users/{seller_id} se disponível
      let sellerNickname = (job.getString('seller_nickname') || '').trim()
      let sellerPermalink = ''
      try {
        const userRes = $http.send({
          url: 'https://api.mercadolibre.com/users/' + encodeURIComponent(primarySellerId),
          method: 'GET',
          headers: { Accept: 'application/json' },
          timeout: 10,
        })
        if (userRes.statusCode === 200 && userRes.json) {
          if (!sellerNickname && userRes.json.nickname) {
            sellerNickname = userRes.json.nickname
          }
          if (userRes.json.permalink) {
            sellerPermalink = userRes.json.permalink
          }
        }
      } catch (uErr) {
        console.log(
          '[ml_competitor_jobs] Aviso: não foi possível obter nickname do vendedor ' +
            primarySellerId +
            ': ' +
            uErr,
        )
      }

      if (!sellerNickname) {
        sellerNickname = 'Concorrente ' + primarySellerId
      }

      const compCol = $app.findCollectionByNameOrId('ml_competitors')
      const adsCol = $app.findCollectionByNameOrId('ml_competitor_ads')
      const histCol = $app.findCollectionByNameOrId('ml_price_history')
      const eventsCol = $app.findCollectionByNameOrId('ml_competitor_events')

      // Criar ou atualizar concorrente em ml_competitors
      let compRecord = null
      try {
        const existingComps = $app.findRecordsByFilter(
          'ml_competitors',
          "seller_id = '" + primarySellerId + "'",
          '-created',
          1,
          0,
        )
        if (existingComps && existingComps.length > 0) {
          compRecord = existingComps[0]
          compRecord.set('active', true)
          if (sellerNickname && sellerNickname !== 'Concorrente ' + primarySellerId) {
            compRecord.set('nickname', sellerNickname)
          }
          if (sellerPermalink && !compRecord.getString('permalink')) {
            compRecord.set('permalink', sellerPermalink)
          }
          $app.save(compRecord)
        }
      } catch (_) {}

      const nowIso = new Date().toISOString()

      if (!compRecord) {
        compRecord = new Record(compCol)
        compRecord.set('seller_id', primarySellerId)
        compRecord.set('nickname', sellerNickname)
        compRecord.set('active', true)
        compRecord.set('permalink', sellerPermalink)
        compRecord.set('last_synced_at', nowIso)
        $app.save(compRecord)
      }

      let adsAddedOrUpdated = 0
      let historyCreated = 0
      let eventsCreated = 0

      for (let i = 0; i < fetchedItems.length; i++) {
        const item = fetchedItems[i]
        const itemId = item.id
        if (!itemId) continue

        const itemSellerId = String(item.seller_id || primarySellerId)
        const price = Number(item.price) || 0
        const soldQuantity = Number(item.sold_quantity) || 0
        const availableQuantity = Number(item.available_quantity) || 0
        let status = (item.status || 'active').toLowerCase()
        // Garantir que status é um dos valores aceitos pelo select ('active', 'paused', 'closed', 'under_review')
        if (
          status !== 'active' &&
          status !== 'paused' &&
          status !== 'closed' &&
          status !== 'under_review'
        ) {
          status = 'active'
        }
        const title = item.title || ''
        const permalink = item.permalink || ''
        const thumbnail =
          item.thumbnail || (item.pictures && item.pictures[0] ? item.pictures[0].url : '')
        const condition = item.condition || ''

        let brand = ''
        let model = ''
        let gtin = ''
        if (Array.isArray(item.attributes)) {
          for (let a = 0; a < item.attributes.length; a++) {
            const attr = item.attributes[a]
            if (attr.id === 'BRAND') brand = attr.value_name || ''
            if (attr.id === 'MODEL') model = attr.value_name || ''
            if (attr.id === 'GTIN') gtin = attr.value_name || ''
          }
        }

        // Verificar se anúncio já existe
        let existingAd = null
        try {
          const exList = $app.findRecordsByFilter(
            'ml_competitor_ads',
            "mlb_item_id = '" + itemId + "'",
            '-created',
            1,
            0,
          )
          if (exList && exList.length > 0) {
            existingAd = exList[0]
          }
        } catch (_) {}

        let isNewAd = false
        let adRecord = null

        if (!existingAd) {
          isNewAd = true
          adRecord = new Record(adsCol)
          adRecord.set('mlb_item_id', itemId)
          adRecord.set('seller_id', itemSellerId)
          adRecord.set('seller_nickname', sellerNickname)
          adRecord.set('title', title)
          adRecord.set('current_price', price)
          adRecord.set('initial_price', price)
          adRecord.set('sold_quantity', soldQuantity)
          adRecord.set('available_quantity', availableQuantity)
          adRecord.set('status', status)
          adRecord.set('permalink', permalink)
          adRecord.set('thumbnail', thumbnail)
          adRecord.set('condition', condition)
          adRecord.set('brand', brand)
          adRecord.set('model', model)
          adRecord.set('gtin', gtin)
          adRecord.set('last_checked', nowIso)
          $app.save(adRecord)
          adsAddedOrUpdated++
        } else {
          adRecord = existingAd
          adRecord.set('seller_nickname', sellerNickname)
          adRecord.set('title', title)
          adRecord.set('current_price', price)
          adRecord.set('sold_quantity', soldQuantity)
          adRecord.set('available_quantity', availableQuantity)
          adRecord.set('status', status)
          adRecord.set('permalink', permalink)
          if (thumbnail) adRecord.set('thumbnail', thumbnail)
          if (brand) adRecord.set('brand', brand)
          if (model) adRecord.set('model', model)
          if (gtin) adRecord.set('gtin', gtin)
          adRecord.set('last_checked', nowIso)
          $app.save(adRecord)
          adsAddedOrUpdated++
        }

        // Criar Snapshot de Histórico de Preços
        try {
          const hRec = new Record(histCol)
          hRec.set('mlb_item_id', itemId)
          hRec.set('seller_id', itemSellerId)
          hRec.set('price', price)
          hRec.set('sold_quantity', soldQuantity)
          hRec.set('available_quantity', availableQuantity)
          hRec.set('status', status)
          hRec.set('checked_at', nowIso)
          $app.save(hRec)
          historyCreated++
        } catch (hErr) {
          console.log('[ml_competitor_jobs] Erro ao gravar snapshot de preco: ' + hErr)
        }

        // Se for novo anúncio, gerar evento em ml_competitor_events
        if (isNewAd) {
          try {
            const ev = new Record(eventsCol)
            ev.set('mlb_item_id', itemId)
            ev.set('seller_id', itemSellerId)
            ev.set('seller_nickname', sellerNickname)
            ev.set('ad_title', title)
            ev.set('event_type', 'new_ad')
            ev.set('old_value', '')
            ev.set('new_value', 'R$ ' + price.toFixed(2))
            ev.set('difference_num', price)
            ev.set('notes', 'Novo anúncio monitorado no Radar.')
            $app.save(ev)
            eventsCreated++
          } catch (evErr) {
            console.log('[ml_competitor_jobs] Erro ao gravar evento new_ad: ' + evErr)
          }
        }
      }

      // Atualizar last_synced_at do concorrente
      try {
        compRecord.set('last_synced_at', nowIso)
        $app.save(compRecord)
      } catch (_) {}

      job.set('status', 'done')
      job.set('status_code', 200)
      job.set('error_message', '')
      job.set('seller_id', primarySellerId)
      job.set('seller_nickname', sellerNickname)
      job.set('result_data', {
        seller_id: primarySellerId,
        seller_nickname: sellerNickname,
        items_processed: fetchedItems.length,
        ads_added_or_updated: adsAddedOrUpdated,
        history_created: historyCreated,
        events_created: eventsCreated,
      })
      $app.save(job)
      console.log(
        '[ml_competitor_jobs] resolve_from_item concluido com sucesso para ' + sellerNickname,
      )
      e.next()
      return
    }

    // -------------------------------------------------------------------------
    // 2. RESOLVE COMPETITOR (Busca textual legada - com aviso claro de 403)
    // -------------------------------------------------------------------------
    if (action === 'resolve_competitor') {
      const searchUrl =
        'https://api.mercadolibre.com/sites/MLB/search?q=' + encodeURIComponent(query) + '&limit=30'

      const headers = { Accept: 'application/json' }
      if (accessToken) headers['Authorization'] = 'Bearer ' + accessToken

      const res = $http.send({
        url: searchUrl,
        method: 'GET',
        headers: headers,
        timeout: 25,
      })

      if (res.statusCode >= 400) {
        job.set('status', 'error')
        job.set('status_code', res.statusCode)
        if (res.statusCode === 403) {
          job.set(
            'error_message',
            'A API do Mercado Livre restringiu a busca pública por nome de vendedor. Monitore concorrentes colando o link do anúncio deles (funciona 100%).',
          )
        } else {
          job.set(
            'error_message',
            'Erro na API do Mercado Livre ao buscar vendedor: HTTP ' + res.statusCode,
          )
        }
        $app.save(job)
        e.next()
        return
      }

      const resJson = res.json || {}
      const results = Array.isArray(resJson.results) ? resJson.results : []
      const sellersMap = {}

      for (let i = 0; i < results.length; i++) {
        const item = results[i]
        const seller = item.seller || {}
        const sId = seller.id ? String(seller.id) : ''
        const sNick = seller.nickname || ''
        const permalink = seller.permalink || ''

        if (sId && !sellersMap[sId]) {
          sellersMap[sId] = {
            seller_id: sId,
            nickname: sNick,
            permalink: permalink,
            sample_ad_title: item.title,
            sample_ad_price: item.price,
            sample_thumbnail: item.thumbnail,
          }
        }
      }

      const sellersList = []
      for (const k in sellersMap) {
        sellersList.push(sellersMap[k])
      }

      job.set('status', 'done')
      job.set('status_code', 200)
      job.set('result_data', { sellers: sellersList, total_found: sellersList.length })
      job.set('error_message', '')
      $app.save(job)
      e.next()
      return
    }

    // -------------------------------------------------------------------------
    // 3. SYNC COMPETITOR & SYNC ALL (Multiget direto dos anúncios monitorados)
    // -------------------------------------------------------------------------
    if (action === 'sync_competitor' || action === 'sync_all') {
      let competitors = []
      if (action === 'sync_competitor') {
        if (targetSellerId) {
          competitors = $app.findRecordsByFilter(
            'ml_competitors',
            "seller_id = '" + targetSellerId + "'",
            '-created',
            1,
            0,
          )
        }
      } else {
        competitors = $app.findRecordsByFilter(
          'ml_competitors',
          'active = true',
          '-created',
          100,
          0,
        )
      }

      if (competitors.length === 0) {
        job.set('status', 'done')
        job.set('status_code', 200)
        job.set('error_message', '')
        job.set('result_data', {
          message: 'Nenhum concorrente ativo para sincronizar.',
          synced_competitors: 0,
        })
        $app.save(job)
        e.next()
        return
      }

      const adsCol = $app.findCollectionByNameOrId('ml_competitor_ads')
      const historyCol = $app.findCollectionByNameOrId('ml_price_history')
      const eventsCol = $app.findCollectionByNameOrId('ml_competitor_events')

      let totalAdsProcessed = 0
      let totalEventsCreated = 0
      let totalHistoryCreated = 0
      const nowIso = new Date().toISOString()
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

      const headers = { Accept: 'application/json' }
      if (accessToken) headers['Authorization'] = 'Bearer ' + accessToken

      for (let cIdx = 0; cIdx < competitors.length; cIdx++) {
        const comp = competitors[cIdx]
        const sId = comp.getString('seller_id')
        const sNick = comp.getString('nickname')

        console.log('[ml_competitor_jobs] Sincronizando concorrente: ' + sNick + ' (' + sId + ')')

        // Buscar todos os anúncios já cadastrados deste concorrente em ml_competitor_ads
        let existingAds = []
        try {
          existingAds = $app.findRecordsByFilter(
            'ml_competitor_ads',
            "seller_id = '" + sId + "'",
            '-created',
            500,
            0,
          )
        } catch (_) {}

        if (existingAds.length === 0) {
          console.log('[ml_competitor_jobs] Nenhum anúncio cadastrado ainda para ' + sNick)
          try {
            comp.set('last_synced_at', nowIso)
            $app.save(comp)
          } catch (_) {}
          continue
        }

        // Consultar anúncios via /items?ids=MLB1,MLB2,... em lotes de até 20
        const chunkSize = 20
        const fetchedItemsMap = {}

        for (let i = 0; i < existingAds.length; i += chunkSize) {
          const chunkRecords = existingAds.slice(i, i + chunkSize)
          const chunkIds = []
          for (let k = 0; k < chunkRecords.length; k++) {
            chunkIds.push(chunkRecords[k].getString('mlb_item_id'))
          }

          const itemsUrl = 'https://api.mercadolibre.com/items?ids=' + chunkIds.join(',')
          let sRes = null
          try {
            sRes = $http.send({
              url: itemsUrl,
              method: 'GET',
              headers: headers,
              timeout: 25,
            })
          } catch (netErr) {
            console.log('[ml_competitor_jobs] Erro no multiget de anúncios: ' + netErr)
            continue
          }

          if (sRes.statusCode >= 400) {
            console.log(
              '[ml_competitor_jobs] API ML retornou HTTP ' +
                sRes.statusCode +
                ' para lote de ' +
                sNick,
            )
            continue
          }

          const list = Array.isArray(sRes.json) ? sRes.json : []
          for (let j = 0; j < list.length; j++) {
            const entry = list[j]
            if (entry && entry.code === 200 && entry.body) {
              fetchedItemsMap[entry.body.id] = entry.body
            }
          }
        }

        // Processar cada anúncio existente com o resultado atualizado da API
        for (let aIdx = 0; aIdx < existingAds.length; aIdx++) {
          const adRecord = existingAds[aIdx]
          const itemId = adRecord.getString('mlb_item_id')
          const item = fetchedItemsMap[itemId]
          if (!item) continue

          totalAdsProcessed++
          const price = Number(item.price) || 0
          const soldQuantity = Number(item.sold_quantity) || 0
          const availableQuantity = Number(item.available_quantity) || 0
          let status = (item.status || 'active').toLowerCase()
          if (
            status !== 'active' &&
            status !== 'paused' &&
            status !== 'closed' &&
            status !== 'under_review'
          ) {
            status = 'active'
          }
          const title = item.title || ''
          const permalink = item.permalink || ''
          const thumbnail =
            item.thumbnail || (item.pictures && item.pictures[0] ? item.pictures[0].url : '')

          const oldPrice = adRecord.getFloat('current_price')
          const oldSold = adRecord.getInt('sold_quantity')
          const oldStock = adRecord.getInt('available_quantity')
          const oldStatus = adRecord.getString('status')

          let isPriceChanged = false
          let isSoldChanged = false
          let isStockChanged = false
          let isStatusChanged = false

          if (oldPrice > 0 && Math.abs(oldPrice - price) >= 0.01) {
            isPriceChanged = true
          }
          if (soldQuantity > oldSold) {
            isSoldChanged = true
          }
          if (oldStock !== availableQuantity) {
            isStockChanged = true
          }
          if (oldStatus && oldStatus !== status) {
            isStatusChanged = true
          }

          // Atualizar registro do anúncio
          adRecord.set('title', title)
          adRecord.set('current_price', price)
          adRecord.set('sold_quantity', soldQuantity)
          adRecord.set('available_quantity', availableQuantity)
          adRecord.set('status', status)
          adRecord.set('permalink', permalink)
          if (thumbnail) adRecord.set('thumbnail', thumbnail)
          adRecord.set('last_checked', nowIso)
          $app.save(adRecord)

          // Gravar Snapshot em ml_price_history se houve mudança ou há mais de 1h sem registro
          let recentHistory = null
          try {
            const hList = $app.findRecordsByFilter(
              'ml_price_history',
              "mlb_item_id = '" + itemId + "' && checked_at >= '" + oneHourAgo + "'",
              '-checked_at',
              1,
              0,
            )
            if (hList && hList.length > 0) {
              recentHistory = hList[0]
            }
          } catch (_) {}

          if (!recentHistory || isPriceChanged || isSoldChanged) {
            try {
              const hRec = new Record(historyCol)
              hRec.set('mlb_item_id', itemId)
              hRec.set('seller_id', sId)
              hRec.set('price', price)
              hRec.set('sold_quantity', soldQuantity)
              hRec.set('available_quantity', availableQuantity)
              hRec.set('status', status)
              hRec.set('checked_at', nowIso)
              $app.save(hRec)
              totalHistoryCreated++
            } catch (_) {}
          }

          // Gerar Eventos de Mudança em ml_competitor_events
          if (isPriceChanged) {
            const diff = price - oldPrice
            try {
              const ev = new Record(eventsCol)
              ev.set('mlb_item_id', itemId)
              ev.set('seller_id', sId)
              ev.set('seller_nickname', sNick)
              ev.set('ad_title', title)
              ev.set('event_type', 'price_change')
              ev.set('old_value', 'R$ ' + oldPrice.toFixed(2))
              ev.set('new_value', 'R$ ' + price.toFixed(2))
              ev.set('difference_num', diff)
              ev.set(
                'notes',
                diff < 0
                  ? 'Concorrente baixou o preço em R$ ' + Math.abs(diff).toFixed(2)
                  : 'Concorrente aumentou o preço em R$ ' + diff.toFixed(2),
              )
              $app.save(ev)
              totalEventsCreated++
            } catch (_) {}
          }

          if (isSoldChanged) {
            const diffSold = soldQuantity - oldSold
            try {
              const ev = new Record(eventsCol)
              ev.set('mlb_item_id', itemId)
              ev.set('seller_id', sId)
              ev.set('seller_nickname', sNick)
              ev.set('ad_title', title)
              ev.set('event_type', 'sold_progress')
              ev.set('old_value', String(oldSold))
              ev.set('new_value', String(soldQuantity))
              ev.set('difference_num', diffSold)
              ev.set('notes', 'Concorrente realizou ' + diffSold + ' nova(s) venda(s).')
              $app.save(ev)
              totalEventsCreated++
            } catch (_) {}
          }

          if (isStatusChanged) {
            try {
              const ev = new Record(eventsCol)
              ev.set('mlb_item_id', itemId)
              ev.set('seller_id', sId)
              ev.set('seller_nickname', sNick)
              ev.set('ad_title', title)
              ev.set(
                'event_type',
                status === 'paused'
                  ? 'ad_paused'
                  : status === 'closed'
                    ? 'ad_closed'
                    : 'stock_change',
              )
              ev.set('old_value', oldStatus)
              ev.set('new_value', status)
              ev.set('difference_num', 0)
              ev.set(
                'notes',
                'Status do anúncio alterado de ' + oldStatus + ' para ' + status + '.',
              )
              $app.save(ev)
              totalEventsCreated++
            } catch (_) {}
          } else if (isStockChanged && !isSoldChanged) {
            const diffStock = availableQuantity - oldStock
            try {
              const ev = new Record(eventsCol)
              ev.set('mlb_item_id', itemId)
              ev.set('seller_id', sId)
              ev.set('seller_nickname', sNick)
              ev.set('ad_title', title)
              ev.set('event_type', 'stock_change')
              ev.set('old_value', String(oldStock))
              ev.set('new_value', String(availableQuantity))
              ev.set('difference_num', diffStock)
              ev.set(
                'notes',
                'Estoque disponível alterado de ' + oldStock + ' para ' + availableQuantity + '.',
              )
              $app.save(ev)
              totalEventsCreated++
            } catch (_) {}
          }
        }

        // Atualizar data de sincronização do concorrente
        try {
          comp.set('last_synced_at', nowIso)
          $app.save(comp)
        } catch (_) {}
      }

      job.set('status', 'done')
      job.set('status_code', 200)
      job.set('error_message', '')
      job.set('result_data', {
        competitors_count: competitors.length,
        ads_processed: totalAdsProcessed,
        events_created: totalEventsCreated,
        history_snapshots: totalHistoryCreated,
      })
      $app.save(job)
      console.log(
        '[ml_competitor_jobs] Sincronização concluída: ' +
          totalAdsProcessed +
          ' anúncios atualizados.',
      )
      e.next()
      return
    }

    // -------------------------------------------------------------------------
    // 4. SEARCH QUERY (Busca auxiliar)
    // -------------------------------------------------------------------------
    if (action === 'search_query') {
      const searchUrl =
        'https://api.mercadolibre.com/sites/MLB/search?q=' + encodeURIComponent(query) + '&limit=40'
      const headers = { Accept: 'application/json' }
      if (accessToken) headers['Authorization'] = 'Bearer ' + accessToken

      const sRes = $http.send({
        url: searchUrl,
        method: 'GET',
        headers: headers,
        timeout: 25,
      })

      if (sRes.statusCode >= 400) {
        job.set('status', 'error')
        job.set('status_code', sRes.statusCode)
        job.set(
          'error_message',
          sRes.statusCode === 403
            ? 'A API do Mercado Livre bloqueou a busca textual direta (HTTP 403). Use a consulta por link ou código MLB.'
            : 'Erro na API do Mercado Livre: HTTP ' + sRes.statusCode,
        )
        $app.save(job)
        e.next()
        return
      }

      const results = Array.isArray(sRes.json?.results) ? sRes.json.results : []
      const adsList = []
      for (let i = 0; i < results.length; i++) {
        const it = results[i]
        adsList.push({
          id: it.id,
          title: it.title,
          price: it.price,
          sold_quantity: it.sold_quantity || 0,
          available_quantity: it.available_quantity || 0,
          condition: it.condition || '',
          thumbnail: it.thumbnail || '',
          permalink: it.permalink || '',
          seller: it.seller || {},
        })
      }

      job.set('status', 'done')
      job.set('status_code', 200)
      job.set('result_data', { ads: adsList, total_found: adsList.length })
      job.set('error_message', '')
      $app.save(job)
      e.next()
      return
    }

    // Ação desconhecida
    job.set('status', 'error')
    job.set('status_code', 400)
    job.set('error_message', 'Ação inválida: ' + action)
    $app.save(job)
    e.next()
  } catch (err) {
    const msg = err.message || String(err)
    console.log('[ml_competitor_jobs] Exceção geral no processamento: ' + msg)
    job.set('status', 'error')
    job.set('status_code', 500)
    job.set('error_message', 'Falha interna no processamento: ' + msg)
    $app.save(job)
    e.next()
  }
}, 'ml_competitor_jobs')
