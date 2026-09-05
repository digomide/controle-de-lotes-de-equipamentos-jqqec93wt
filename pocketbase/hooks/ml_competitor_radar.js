// Hook para processamento assíncrono da fila de jobs de concorrentes ML (ml_competitor_jobs)
// Ações suportadas:
// - 'resolve_competitor': busca o seller_id e dados a partir de um apelido ou busca textual pública
// - 'sync_competitor': busca anúncios do concorrente informado, atualiza ml_competitor_ads, gera ml_price_history e ml_competitor_events
// - 'sync_all': varre todos os concorrentes ativos e sincroniza seus anúncios
// - 'search_query': busca anúncios concorrentes no ML pelo termo de busca (ex: "ThinkPad T480")

onRecordAfterCreateSuccess((e) => {
  const job = e.record
  if (!job || job.getString('status') !== 'pending') {
    e.next()
    return
  }

  job.set('status', 'processing')
  $app.save(job)

  // Token OAuth próprio (se houver e não for estritamente necessário, podemos enviar Authorization ou fazer chamada limpa)
  // Como são endpoints públicos /sites/MLB/search e /items, enviamos Bearer se disponível para obter maior rate-limit.
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
    if (action === 'resolve_competitor') {
      // 1. Resolver concorrente: busca por termo no ML para encontrar vendedores
      let searchUrl =
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
        job.set(
          'error_message',
          'Erro na API do Mercado Livre ao buscar vendedor: HTTP ' + res.statusCode,
        )
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

    if (action === 'sync_competitor' || action === 'sync_all') {
      // Carregar competidores a sincronizar
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
        if (competitors.length === 0 && targetSellerId) {
          // Criar temporário se foi solicitado sincronizar direto por ID
          competitors = [
            {
              getString: function (k) {
                if (k === 'seller_id') return targetSellerId
                if (k === 'nickname')
                  return job.getString('seller_nickname') || 'Concorrente ' + targetSellerId
                return ''
              },
              id: '',
            },
          ]
        }
      } else {
        // sync_all: todos ativos
        competitors = $app.findRecordsByFilter('ml_competitors', 'active = true', '-created', 50, 0)
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

      for (let cIdx = 0; cIdx < competitors.length; cIdx++) {
        const comp = competitors[cIdx]
        const sId = comp.getString('seller_id')
        const sNick = comp.getString('nickname')

        console.log('[ml_competitor_jobs] Sincronizando concorrente: ' + sNick + ' (' + sId + ')')

        // Buscar anúncios públicos do seller via /sites/MLB/search?seller_id=...
        const sellerSearchUrl =
          'https://api.mercadolibre.com/sites/MLB/search?seller_id=' +
          encodeURIComponent(sId) +
          '&limit=50'
        const headers = { Accept: 'application/json' }
        if (accessToken) headers['Authorization'] = 'Bearer ' + accessToken

        let sRes = null
        try {
          sRes = $http.send({
            url: sellerSearchUrl,
            method: 'GET',
            headers: headers,
            timeout: 25,
          })
        } catch (netErr) {
          console.log(
            '[ml_competitor_jobs] Erro ao buscar anuncios do seller ' + sId + ': ' + netErr,
          )
          continue
        }

        if (sRes.statusCode >= 400) {
          console.log(
            '[ml_competitor_jobs] API ML retornou HTTP ' + sRes.statusCode + ' para seller ' + sId,
          )
          continue
        }

        const items = Array.isArray(sRes.json?.results) ? sRes.json.results : []
        totalAdsProcessed += items.length

        for (let i = 0; i < items.length; i++) {
          const item = items[i]
          const itemId = item.id
          if (!itemId) continue

          const price = Number(item.price) || 0
          const soldQuantity = Number(item.sold_quantity) || 0
          const availableQuantity = Number(item.available_quantity) || 0
          const status = (item.status || 'active').toLowerCase()
          const title = item.title || ''
          const permalink = item.permalink || ''
          const thumbnail = item.thumbnail || ''
          const condition = item.condition || ''

          // Extrair marca e modelo de attributes se presente
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

          // Verificar se já temos esse anúncio registrado
          let existingAd = null
          try {
            const existingList = $app.findRecordsByFilter(
              'ml_competitor_ads',
              "mlb_item_id = '" + itemId + "'",
              '-created',
              1,
              0,
            )
            if (existingList && existingList.length > 0) {
              existingAd = existingList[0]
            }
          } catch (_) {}

          let isNewAd = false
          let isPriceChanged = false
          let isSoldChanged = false
          let isStockChanged = false
          let isStatusChanged = false

          let oldPrice = 0
          let oldSold = 0
          let oldStock = 0
          let oldStatus = ''

          let adRecord = null

          if (!existingAd) {
            isNewAd = true
            adRecord = new Record(adsCol)
            adRecord.set('mlb_item_id', itemId)
            adRecord.set('seller_id', sId)
            adRecord.set('seller_nickname', sNick)
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
          } else {
            adRecord = existingAd
            oldPrice = adRecord.getFloat('current_price')
            oldSold = adRecord.getInt('sold_quantity')
            oldStock = adRecord.getInt('available_quantity')
            oldStatus = adRecord.getString('status')

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
          }

          // Gravar Snapshot em ml_price_history (evitar duplicar dentro da mesma hora)
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
          }

          // Gerar Eventos de Mudança em ml_competitor_events
          if (isNewAd) {
            const ev = new Record(eventsCol)
            ev.set('mlb_item_id', itemId)
            ev.set('seller_id', sId)
            ev.set('seller_nickname', sNick)
            ev.set('ad_title', title)
            ev.set('event_type', 'new_ad')
            ev.set('old_value', '')
            ev.set('new_value', 'R$ ' + price.toFixed(2))
            ev.set('difference_num', price)
            ev.set('notes', 'Novo anúncio monitorado no catálogo do concorrente.')
            $app.save(ev)
            totalEventsCreated++
          } else {
            if (isPriceChanged) {
              const diff = price - oldPrice
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
            }

            if (isSoldChanged) {
              const diffSold = soldQuantity - oldSold
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
            }

            if (isStatusChanged) {
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
                    : 'status_change',
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
            } else if (isStockChanged && !isSoldChanged) {
              const diffStock = availableQuantity - oldStock
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
            }
          }
        }

        // Atualizar last_synced_at do concorrente se for record salvo
        if (comp.id) {
          try {
            comp.set('last_synced_at', nowIso)
            $app.save(comp)
          } catch (_) {}
        }
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
        '[ml_competitor_jobs] Concluído com sucesso: ' +
          totalAdsProcessed +
          ' anúncios processados.',
      )
      e.next()
      return
    }

    if (action === 'search_query') {
      // Busca geral por termo para encontrar concorrentes ou anúncios do termo
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
        job.set('error_message', 'Erro na API do Mercado Livre: HTTP ' + sRes.statusCode)
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
