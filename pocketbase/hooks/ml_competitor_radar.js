// Hook para processamento assíncrono da fila de jobs de concorrentes ML (ml_competitor_jobs)
// Ações suportadas:
// - 'resolve_from_item': extrai seller_id e dados via CASCADE multiget -> catalog product /items -> page scraping, cria/atualiza ml_competitors, salva anúncio(s) em ml_competitor_ads, cria ml_price_history inicial e evento new_ad.
// - 'resolve_competitor': busca o seller_id e dados a partir de busca textual pública (avisa 403 se restrito)
// - 'sync_competitor': sincroniza anúncios monitorados de um concorrente usando a CASCADE de resolução
// - 'sync_all': varre todos os anúncios monitorados ativos usando a CASCADE com delays entre requisições
// - 'search_query': busca anúncios concorrentes no ML

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

  // -------------------------------------------------------------------------
  // Helper: Resolução de item individual via CASCADE de estratégias
  // Estratégia 1: API multiget /items?ids=MLB... (com token)
  // Estratégia 2: API catalog product /products/{id} e /products/{id}/items (para itens de catálogo /p/MLB...)
  // Estratégia 3: Web scraping da página pública com múltiplos user-agents e extração resiliente
  // -------------------------------------------------------------------------
  function parseHtmlAdData(html, fallbackMlbId) {
    const data = {
      title: '',
      price: 0,
      seller_id: '',
      seller_nickname: '',
      thumbnail: '',
      sold_quantity: 0,
      status: 'active',
    }

    if (!html || typeof html !== 'string') return data

    // 1. TÍTULO
    // a. og:title
    const ogTitleMatch =
      html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)
    if (ogTitleMatch && ogTitleMatch[1]) {
      data.title = ogTitleMatch[1].replace(/&amp;/g, '&').replace(/&#39;/g, "'").trim()
    }
    // b. <title>
    if (!data.title) {
      const tMatch = html.match(/<title>([^<]+)<\/title>/i)
      if (tMatch && tMatch[1]) {
        let t = tMatch[1].replace(/\s*\|\s*Mercado\s*Livre.*$/i, '').trim()
        t = t.replace(/\s*-\s*Mercado\s*Livre.*$/i, '').trim()
        if (t && !t.toLowerCase().includes('atenção') && !t.toLowerCase().includes('robot')) {
          data.title = t
        }
      }
    }
    // c. <h1>
    if (!data.title) {
      const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
      if (h1Match && h1Match[1]) {
        data.title = h1Match[1].replace(/<[^>]+>/g, '').trim()
      }
    }

    // 2. PREÇO
    // a. Meta tag og:price ou product:price:amount ou price:amount
    const ogPriceMatch =
      html.match(
        /<meta[^>]+property=["'](?:product:price:amount|price:amount)["'][^>]+content=["']([^"']+)["']/i,
      ) ||
      html.match(
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["'](?:product:price:amount|price:amount)["']/i,
      )
    if (ogPriceMatch && ogPriceMatch[1]) {
      data.price = parseFloat(ogPriceMatch[1]) || 0
    }

    // b. JSON-LD scripts (<script type="application/ld+json">)
    if (!data.price || data.price <= 0) {
      const ldScripts =
        html.match(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi) || []
      for (let s = 0; s < ldScripts.length; s++) {
        try {
          const jsonStr = ldScripts[s].replace(/<\/?script[^>]*>/gi, '')
          const ldObj = JSON.parse(jsonStr)
          const offers =
            ldObj.offers ||
            (ldObj['@graph'] &&
              ldObj['@graph'].find(function (g) {
                return g && g.offers
              })?.offers)
          if (offers) {
            const oPrice = Array.isArray(offers) ? offers[0].price : offers.price
            if (oPrice) {
              data.price = parseFloat(oPrice) || data.price
            }
          }
          if (ldObj.name && !data.title) {
            data.title = ldObj.name
          }
          if (ldObj.image && !data.thumbnail) {
            data.thumbnail = Array.isArray(ldObj.image) ? ldObj.image[0] : ldObj.image
          }
        } catch (_) {}
      }
    }

    // c. Classes visuais do Mercado Livre: andes-money-amount__fraction
    if (!data.price || data.price <= 0) {
      const fracMatches =
        html.match(/class=["'][^"']*andes-money-amount__fraction[^"']*["']>([^<]+)<\/span>/gi) || []
      for (let fm = 0; fm < fracMatches.length; fm++) {
        const valMatch = fracMatches[fm].match(/>([^<]+)</)
        if (valMatch && valMatch[1]) {
          const cleanFrac = valMatch[1].replace(/\./g, '').replace(',', '.')
          const pVal = parseFloat(cleanFrac) || 0
          if (pVal > 10) {
            data.price = pVal
            break
          }
        }
      }
    }

    // d. Script __PRELOADED_STATE__ ou __NORDIC_RENDERING_CTX__ ou initialState
    if (!data.price || data.price <= 0) {
      const pMatch =
        html.match(/"price":\s*([0-9]+(?:\.[0-9]+)?)/) ||
        html.match(/"amount":\s*([0-9]+(?:\.[0-9]+)?)/) ||
        html.match(/"price_amount":\s*([0-9]+(?:\.[0-9]+)?)/)
      if (pMatch && pMatch[1]) {
        const val = parseFloat(pMatch[1])
        if (val > 10) data.price = val
      }
    }

    // 3. THUMBNAIL / IMAGEM
    if (!data.thumbnail) {
      const ogImgMatch =
        html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
      if (ogImgMatch && ogImgMatch[1]) {
        data.thumbnail = ogImgMatch[1]
      }
    }

    // 4. VENDAS (sold_quantity)
    const soldMatch =
      html.match(/\+?\s*([0-9.]+)\s*(?:vendidos|vendidas|vendas)/i) ||
      html.match(/"sold_quantity":\s*([0-9]+)/i)
    if (soldMatch && soldMatch[1]) {
      data.sold_quantity = parseInt(soldMatch[1].replace(/\./g, ''), 10) || 0
    }

    // 5. STATUS
    if (
      html.includes('Publicação encerrada') ||
      html.includes('publicação pausada') ||
      html.includes('Produto esgotado')
    ) {
      data.status = 'closed'
    }

    // 6. SELLER ID / NICKNAME
    const sMatch =
      html.match(/"seller_id":\s*([0-9]+)/i) ||
      html.match(/"sellerId":\s*([0-9]+)/i) ||
      html.match(/seller_id=([0-9]+)/i)
    if (sMatch && sMatch[1]) {
      data.seller_id = sMatch[1]
    }

    const sellerNameMatch =
      html.match(/Vendido\s+por\s+<[^>]+>([^<]+)<\/[^>]+>/i) ||
      html.match(/ui-pdp-seller__link-trigger[^>]*>([^<]+)</i) ||
      html.match(/class=["'][^"']*seller-name[^"']*["']>([^<]+)</i) ||
      html.match(/"seller_name":\s*"([^"]+)"/i) ||
      html.match(/"seller_nickname":\s*"([^"]+)"/i)
    if (sellerNameMatch && sellerNameMatch[1]) {
      data.seller_nickname = sellerNameMatch[1].replace(/<[^>]+>/g, '').trim()
    }

    return data
  }

  // -------------------------------------------------------------------------
  // Helper: Resolução de item individual via CASCADE de estratégias:
  // a. GET /items?ids=MLB... autenticado (200/206 -> se 403/404, avança)
  // b. GET /products/{product_id} (API de catálogo ML com buy_box_winner e children_ids)
  // c. Scraping da página pública (/p/MLB... ou /MLB... ou link fornecido) com User-Agent real
  // d. Relatório detalhado por item caso falhe
  // -------------------------------------------------------------------------
  function resolveSingleItem(idOrUrl, preferredSellerId) {
    const cleanInput = String(idOrUrl || '').trim()

    // Identificar MLB ID principal
    let mlbId = ''
    const m = cleanInput.match(/MLB-?[0-9]{8,14}/i)
    if (m) {
      mlbId = m[0].toUpperCase().replace('-', '')
    }

    // Também verificar se há parâmetro wid=MLB... na URL
    let widMlbId = ''
    const widMatch = cleanInput.match(/[?&#]wid=(MLB-?[0-9]{8,14})/i)
    if (widMatch) {
      widMlbId = widMatch[1].toUpperCase().replace('-', '')
    }

    if (!mlbId && !cleanInput.startsWith('http')) {
      return { success: false, mlbId: cleanInput, error: 'Código MLB inválido' }
    }

    const itemResult = {
      id: widMlbId || mlbId,
      seller_id: preferredSellerId || '',
      seller_nickname: '',
      title: '',
      price: 0,
      sold_quantity: 0,
      available_quantity: 1,
      status: 'active',
      permalink: cleanInput.startsWith('http')
        ? cleanInput
        : 'https://produto.mercadolivre.com.br/' + (widMlbId || mlbId),
      thumbnail: '',
      condition: 'recondicionado',
      brand: '',
      model: '',
      gtin: '',
      strategy_used: '',
      failure_reasons: [],
    }

    const authHeaders = { Accept: 'application/json' }
    if (accessToken) authHeaders['Authorization'] = 'Bearer ' + accessToken

    const candidatesToQuery = []
    if (mlbId) candidatesToQuery.push(mlbId)
    if (widMlbId && widMlbId !== mlbId) candidatesToQuery.push(widMlbId)

    // -----------------------------------------------------------------------
    // ETAPA A: GET autenticado /items?ids=MLB...
    // Tratar 200 e 206 parcial; se 403/404, segue para a próxima etapa
    // -----------------------------------------------------------------------
    for (let c = 0; c < candidatesToQuery.length; c++) {
      const candId = candidatesToQuery[c]
      try {
        const mgRes = $http.send({
          url: 'https://api.mercadolibre.com/items?ids=' + encodeURIComponent(candId),
          method: 'GET',
          headers: authHeaders,
          timeout: 10,
        })

        if (mgRes.statusCode === 200 || mgRes.statusCode === 206) {
          const bodyList = Array.isArray(mgRes.json) ? mgRes.json : []
          if (bodyList.length > 0 && bodyList[0].code === 200 && bodyList[0].body) {
            const b = bodyList[0].body
            itemResult.id = b.id || candId
            itemResult.title = b.title || itemResult.title
            itemResult.price = Number(b.price) || 0
            itemResult.sold_quantity = Number(b.sold_quantity) || 0
            itemResult.available_quantity = Number(b.available_quantity) || 1
            itemResult.seller_id = String(b.seller_id || itemResult.seller_id)
            itemResult.permalink = b.permalink || itemResult.permalink
            itemResult.thumbnail =
              b.thumbnail || (b.pictures && b.pictures[0] ? b.pictures[0].url : '')
            itemResult.status = (b.status || 'active').toLowerCase()
            itemResult.condition = b.condition || itemResult.condition
            itemResult.strategy_used = 'api_items_multiget'
            if (Array.isArray(b.attributes)) {
              for (let a = 0; a < b.attributes.length; a++) {
                const at = b.attributes[a]
                if (at.id === 'BRAND') itemResult.brand = at.value_name || ''
                if (at.id === 'MODEL') itemResult.model = at.value_name || ''
                if (at.id === 'GTIN') itemResult.gtin = at.value_name || ''
              }
            }
            if (itemResult.title && itemResult.price > 0) {
              return { success: true, item: itemResult }
            }
          } else {
            const code = bodyList[0] ? bodyList[0].code : mgRes.statusCode
            itemResult.failure_reasons.push('Etapa A (/items?ids=' + candId + '): status ' + code)
          }
        } else {
          itemResult.failure_reasons.push(
            'Etapa A (/items?ids=' + candId + '): HTTP ' + mgRes.statusCode,
          )
        }
      } catch (e1) {
        itemResult.failure_reasons.push('Etapa A (/items?ids=' + candId + '): erro ' + e1)
      }
    }

    // -----------------------------------------------------------------------
    // ETAPA B: API de Catálogo /products/{id} (e sub-endpoints)
    // Permite obter nome oficial, pictures, buy_box_winner com preço e seller_id
    // -----------------------------------------------------------------------
    for (let c = 0; c < candidatesToQuery.length; c++) {
      const candId = candidatesToQuery[c]
      try {
        const prodRes = $http.send({
          url: 'https://api.mercadolibre.com/products/' + encodeURIComponent(candId),
          method: 'GET',
          headers: authHeaders,
          timeout: 10,
        })

        if (prodRes.statusCode === 200 && prodRes.json) {
          const pj = prodRes.json
          if (pj.name || pj.title) {
            itemResult.title = pj.name || pj.title || itemResult.title
          }
          itemResult.status = (pj.status || 'active').toLowerCase()
          if (pj.pictures && pj.pictures[0]) {
            itemResult.thumbnail = pj.pictures[0].url || itemResult.thumbnail
          }
          if (pj.buy_box_winner) {
            itemResult.price = Number(pj.buy_box_winner.price) || itemResult.price
            itemResult.seller_id = String(pj.buy_box_winner.seller_id || itemResult.seller_id)
            if (pj.buy_box_winner.item_id) {
              itemResult.id = pj.buy_box_winner.item_id
              itemResult.permalink =
                'https://produto.mercadolivre.com.br/' + pj.buy_box_winner.item_id
            }
          }
          if (pj.price && !itemResult.price) {
            itemResult.price = Number(pj.price) || 0
          }

          // Se tiver children_ids ou sub-items, consultar ofertas de vendedores
          try {
            const pItemsRes = $http.send({
              url: 'https://api.mercadolibre.com/products/' + encodeURIComponent(candId) + '/items',
              method: 'GET',
              headers: authHeaders,
              timeout: 10,
            })
            if (
              pItemsRes.statusCode === 200 &&
              pItemsRes.json &&
              Array.isArray(pItemsRes.json.results)
            ) {
              const offers = pItemsRes.json.results
              if (offers.length > 0) {
                let chosenOffer = offers[0]
                if (preferredSellerId) {
                  const match = offers.find(function (o) {
                    return String(o.seller_id) === String(preferredSellerId)
                  })
                  if (match) chosenOffer = match
                }
                itemResult.price = Number(chosenOffer.price) || itemResult.price
                itemResult.seller_id = String(chosenOffer.seller_id || itemResult.seller_id)
                if (chosenOffer.item_id) {
                  itemResult.id = chosenOffer.item_id
                  itemResult.permalink =
                    'https://produto.mercadolivre.com.br/' + chosenOffer.item_id
                }
                if (chosenOffer.condition) {
                  itemResult.condition = chosenOffer.condition
                }
              }
            }
          } catch (pItErr) {
            console.log('[ml_competitor_jobs] Sub-items /products/' + candId + '/items: ' + pItErr)
          }

          if (itemResult.title && itemResult.price > 0) {
            itemResult.strategy_used = 'api_catalog_product'
            return { success: true, item: itemResult }
          } else if (itemResult.title) {
            itemResult.strategy_used = 'api_catalog_product_partial'
          }
        } else {
          itemResult.failure_reasons.push(
            'Etapa B (/products/' + candId + '): HTTP ' + prodRes.statusCode,
          )
        }
      } catch (e2) {
        itemResult.failure_reasons.push('Etapa B (/products/' + candId + '): erro ' + e2)
      }
    }

    // -----------------------------------------------------------------------
    // ETAPA C: Scraping da Página Pública com User-Agent real de navegador
    // Parseia og:title, <title>, <h1>, og:price, json-ld, classes visuais e seller
    // -----------------------------------------------------------------------
    const urlsToTry = []
    if (cleanInput.startsWith('http')) {
      urlsToTry.push(cleanInput)
    }
    if (widMlbId) {
      urlsToTry.push('https://produto.mercadolivre.com.br/MLB-' + widMlbId)
      urlsToTry.push('https://produto.mercadolivre.com.br/' + widMlbId)
    }
    if (mlbId) {
      urlsToTry.push('https://www.mercadolivre.com.br/p/' + mlbId)
      urlsToTry.push('https://produto.mercadolivre.com.br/MLB-' + mlbId)
      urlsToTry.push('https://produto.mercadolivre.com.br/' + mlbId)
    }

    const browserHeaders = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    }

    for (let uIdx = 0; uIdx < urlsToTry.length; uIdx++) {
      const pageUrl = urlsToTry[uIdx]
      try {
        const pageRes = $http.send({
          url: pageUrl,
          method: 'GET',
          headers: browserHeaders,
          timeout: 12,
        })

        if (pageRes.statusCode === 200) {
          const html = pageRes.raw || ''

          if (
            html.includes('suspicious-traffic-frontend') ||
            html.includes('account-verification')
          ) {
            itemResult.failure_reasons.push(
              'Etapa C (' + pageUrl + '): bloqueio de tráfego/verificação bot',
            )
            continue
          }

          const parsed = parseHtmlAdData(html, widMlbId || mlbId)
          if (parsed.title && !itemResult.title) {
            itemResult.title = parsed.title
          }
          if (parsed.price > 0 && (!itemResult.price || itemResult.price <= 0)) {
            itemResult.price = parsed.price
          }
          if (parsed.thumbnail && !itemResult.thumbnail) {
            itemResult.thumbnail = parsed.thumbnail
          }
          if (parsed.sold_quantity > 0) {
            itemResult.sold_quantity = parsed.sold_quantity
          }
          if (parsed.status) {
            itemResult.status = parsed.status
          }
          if (parsed.seller_id && !itemResult.seller_id) {
            itemResult.seller_id = parsed.seller_id
          }
          if (parsed.seller_nickname && !itemResult.seller_nickname) {
            itemResult.seller_nickname = parsed.seller_nickname
          }

          if (itemResult.title && itemResult.price > 0) {
            itemResult.strategy_used = 'web_scraping_page'
            return { success: true, item: itemResult }
          }
        } else {
          itemResult.failure_reasons.push('Etapa C (' + pageUrl + '): HTTP ' + pageRes.statusCode)
        }
      } catch (ePage) {
        itemResult.failure_reasons.push('Etapa C (' + pageUrl + '): erro ' + ePage)
      }
    }

    // Se temos pelo menos o título (mesmo se o preço ficou 0 por falta de ofertas imediatas), retorna com sucesso
    if (itemResult.title) {
      itemResult.strategy_used = itemResult.strategy_used || 'partial_metadata'
      return { success: true, item: itemResult }
    }

    return {
      success: false,
      mlbId: widMlbId || mlbId || cleanInput,
      error:
        itemResult.failure_reasons.join(' | ') ||
        'Não foi possível ler os dados do anúncio (bloqueio do ML).',
    }
  }

  // -------------------------------------------------------------------------
  // Helper: Obter nickname do vendedor via API /users/{id} ou fallback
  // -------------------------------------------------------------------------
  function resolveSellerNickname(sellerId, fallbackNick) {
    if (!sellerId) return fallbackNick || 'Vendedor Desconhecido'
    if (
      fallbackNick &&
      !fallbackNick.startsWith('Concorrente ') &&
      !fallbackNick.startsWith('Vendedor ')
    ) {
      return fallbackNick
    }

    const headers = { Accept: 'application/json' }
    if (accessToken) headers['Authorization'] = 'Bearer ' + accessToken

    try {
      const uRes = $http.send({
        url: 'https://api.mercadolibre.com/users/' + encodeURIComponent(sellerId),
        method: 'GET',
        headers: headers,
        timeout: 8,
      })
      if (uRes.statusCode === 200 && uRes.json && uRes.json.nickname) {
        return uRes.json.nickname
      }
    } catch (_) {}

    return fallbackNick || 'Concorrente ' + sellerId
  }

  try {
    // -------------------------------------------------------------------------
    // 1. RESOLVE FROM ITEM (Novo fluxo em cascata robusto)
    // -------------------------------------------------------------------------
    if (action === 'resolve_from_item') {
      let rawInput = query
      let parsedIdsOrUrls = []

      try {
        const rd = job.get('result_data')
        if (rd && Array.isArray(rd.item_ids)) {
          parsedIdsOrUrls = rd.item_ids
        }
      } catch (_) {}

      // Se não havia array estruturado, parsear URLs e MLBs da query
      if (parsedIdsOrUrls.length === 0 && rawInput) {
        const lines = rawInput
          .split(/[\r\n,;]+/)
          .map(function (l) {
            return l.trim()
          })
          .filter(Boolean)
        const seen = {}
        for (let l = 0; l < lines.length; l++) {
          const line = lines[l]
          const m = line.match(/MLB-?[0-9]{8,14}/i)
          const key = m ? m[0].toUpperCase().replace('-', '') : line
          if (!seen[key]) {
            seen[key] = true
            parsedIdsOrUrls.push(line)
          }
        }
      }

      if (parsedIdsOrUrls.length === 0) {
        job.set('status', 'error')
        job.set('status_code', 400)
        job.set(
          'error_message',
          'Nenhum código MLB ou link válido encontrado. Cole o link do anúncio do Mercado Livre ou código como MLB1234567890.',
        )
        $app.save(job)
        e.next()
        return
      }

      console.log(
        '[ml_competitor_jobs] resolve_from_item com ' +
          parsedIdsOrUrls.length +
          ' item(s): ' +
          parsedIdsOrUrls.join(','),
      )

      const fetchedItems = []
      const failedItems = []

      for (let i = 0; i < parsedIdsOrUrls.length; i++) {
        const target = parsedIdsOrUrls[i]
        // Delay de 200ms entre itens se múltiplos
        if (i > 0) {
          $os.sleep ? $os.sleep(200) : null
        }
        const res = resolveSingleItem(target, targetSellerId)
        if (res.success && res.item) {
          fetchedItems.push(res.item)
        } else {
          failedItems.push({
            target: target,
            mlbId: res.mlbId,
            error: res.error,
          })
        }
      }

      // Se NENHUM item foi resolvido
      if (fetchedItems.length === 0) {
        job.set('status', 'error')
        job.set('status_code', 404)
        const details = failedItems
          .map(function (f) {
            return (f.mlbId || f.target) + ': ' + f.error
          })
          .join('; ')
        job.set(
          'error_message',
          'O Mercado Livre bloqueou a consulta de todos os anúncios informados (' +
            details +
            '). O link ou ID foi reconhecido, mas as fontes públicas e oficiais do ML retornaram bloqueio.',
        )
        job.set('result_data', {
          failed_items: failedItems,
          total_attempted: parsedIdsOrUrls.length,
        })
        $app.save(job)
        e.next()
        return
      }

      // Identificar vendedor principal
      let primarySellerId = targetSellerId
      if (!primarySellerId) {
        for (let fi = 0; fi < fetchedItems.length; fi++) {
          if (fetchedItems[fi].seller_id) {
            primarySellerId = fetchedItems[fi].seller_id
            break
          }
        }
      }
      if (!primarySellerId) {
        // Se ainda não temos sellerId, gera um identificador baseado no primeiro MLB para permitir salvar e editar
        primarySellerId = 'mlb_' + (fetchedItems[0].id || 'concorrente')
      }

      let sellerNickname = (job.getString('seller_nickname') || '').trim()
      sellerNickname = resolveSellerNickname(primarySellerId, sellerNickname)

      const compCol = $app.findCollectionByNameOrId('ml_competitors')
      const adsCol = $app.findCollectionByNameOrId('ml_competitor_ads')
      const histCol = $app.findCollectionByNameOrId('ml_price_history')
      const eventsCol = $app.findCollectionByNameOrId('ml_competitor_events')

      const nowIso = new Date().toISOString()

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
          $app.save(compRecord)
        }
      } catch (_) {}

      if (!compRecord) {
        compRecord = new Record(compCol)
        compRecord.set('seller_id', primarySellerId)
        compRecord.set('nickname', sellerNickname)
        compRecord.set('active', true)
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
        const availableQuantity = Number(item.available_quantity) || 1
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
        const thumbnail = item.thumbnail || ''
        const condition = item.condition || ''
        const brand = item.brand || ''
        const model = item.model || ''
        const gtin = item.gtin || ''

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

        // Snapshot de Histórico
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
          console.log('[ml_competitor_jobs] Erro snapshot preco: ' + hErr)
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
            console.log('[ml_competitor_jobs] Erro evento new_ad: ' + evErr)
          }
        }
      }

      // Atualizar data de sincronização do concorrente
      try {
        compRecord.set('last_synced_at', nowIso)
        $app.save(compRecord)
      } catch (_) {}

      // Mensagem informativa em caso de sucesso total ou parcial
      let successMsg = ''
      if (failedItems.length > 0) {
        successMsg =
          fetchedItems.length +
          ' de ' +
          (fetchedItems.length + failedItems.length) +
          ' anúncio(s) monitorado(s); ' +
          failedItems
            .map(function (f) {
              return f.mlbId || f.target
            })
            .join(', ') +
          ' não puderam ser lidos (bloqueio do ML).'
      }

      job.set('status', 'done')
      job.set('status_code', 200)
      job.set('error_message', successMsg)
      job.set('seller_id', primarySellerId)
      job.set('seller_nickname', sellerNickname)
      job.set('result_data', {
        seller_id: primarySellerId,
        seller_nickname: sellerNickname,
        items_processed: fetchedItems.length,
        items_failed: failedItems.length,
        failed_items: failedItems,
        ads_added_or_updated: adsAddedOrUpdated,
        history_created: historyCreated,
        events_created: eventsCreated,
        message: successMsg,
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
            'A API do Mercado Livre restringiu a busca pública por termos de vendedores. Monitore concorrentes colando o link do anúncio deles.',
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
    // 3. SYNC COMPETITOR & SYNC ALL (Sincronização com CASCADE para cada anúncio)
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

      for (let cIdx = 0; cIdx < competitors.length; cIdx++) {
        const comp = competitors[cIdx]
        const sId = comp.getString('seller_id')
        const sNick = comp.getString('nickname')

        console.log('[ml_competitor_jobs] Sincronizando concorrente: ' + sNick + ' (' + sId + ')')

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
          try {
            comp.set('last_synced_at', nowIso)
            $app.save(comp)
          } catch (_) {}
          continue
        }

        // Atualizar cada anúncio usando a CASCADE de resolução
        for (let aIdx = 0; aIdx < existingAds.length; aIdx++) {
          const adRecord = existingAds[aIdx]
          const itemId = adRecord.getString('mlb_item_id')
          const adPermalink = adRecord.getString('permalink')

          // Delay de 200ms entre itens para evitar rate limits
          if (aIdx > 0) {
            $os.sleep ? $os.sleep(200) : null
          }

          const resCascade = resolveSingleItem(adPermalink || itemId, sId)
          if (!resCascade.success || !resCascade.item) {
            console.log(
              '[ml_competitor_jobs] Anúncio ' +
                itemId +
                ' não pôde ser atualizado no sync: ' +
                resCascade.error,
            )
            continue
          }

          const item = resCascade.item
          totalAdsProcessed++

          const price = Number(item.price) || 0
          const soldQuantity = Number(item.sold_quantity) || 0
          const availableQuantity = Number(item.available_quantity) || 1
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
          const thumbnail = item.thumbnail || ''

          const oldPrice = adRecord.getFloat('current_price')
          const oldSold = adRecord.getInt('sold_quantity')
          const oldStock = adRecord.getInt('available_quantity')
          const oldStatus = adRecord.getString('status')

          let isPriceChanged = false
          let isSoldChanged = false
          let isStockChanged = false
          let isStatusChanged = false

          if (oldPrice > 0 && price > 0 && Math.abs(oldPrice - price) >= 0.01) {
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
          if (title) adRecord.set('title', title)
          if (price > 0) adRecord.set('current_price', price)
          adRecord.set('sold_quantity', soldQuantity)
          adRecord.set('available_quantity', availableQuantity)
          adRecord.set('status', status)
          if (permalink) adRecord.set('permalink', permalink)
          if (thumbnail) adRecord.set('thumbnail', thumbnail)
          adRecord.set('last_checked', nowIso)
          $app.save(adRecord)

          // Snapshot em ml_price_history se mudou ou passou mais de 1 hora
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
              hRec.set('price', price > 0 ? price : oldPrice)
              hRec.set('sold_quantity', soldQuantity)
              hRec.set('available_quantity', availableQuantity)
              hRec.set('status', status)
              hRec.set('checked_at', nowIso)
              $app.save(hRec)
              totalHistoryCreated++
            } catch (_) {}
          }

          // Gerar Eventos em ml_competitor_events
          if (isPriceChanged) {
            const diff = price - oldPrice
            try {
              const ev = new Record(eventsCol)
              ev.set('mlb_item_id', itemId)
              ev.set('seller_id', sId)
              ev.set('seller_nickname', sNick)
              ev.set('ad_title', title || adRecord.getString('title'))
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
              ev.set('ad_title', title || adRecord.getString('title'))
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
              ev.set('ad_title', title || adRecord.getString('title'))
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
          }
        }

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
    // 3b. INVESTIGATE COMPETITION (Diagnóstico direto de concorrência ML)
    // -------------------------------------------------------------------------
    if (action === 'resolve_competitor' && query.startsWith('PROBE_COMPETITION:')) {
      const parts = query.replace('PROBE_COMPETITION:', '').trim().split('|')
      const probeTarget = parts[0] || 'MLB5193740831'
      const probeCatalog = (parts[1] || job.getString('seller_id') || 'MLB18732668').trim()
      const diagResults = {}

      const authHeaders = { Accept: 'application/json' }
      if (accessToken) authHeaders['Authorization'] = 'Bearer ' + accessToken

      // 1. GET /items/{probeTarget}
      try {
        const r1 = $http.send({
          url: 'https://api.mercadolibre.com/items/' + probeTarget,
          method: 'GET',
          headers: authHeaders,
          timeout: 10,
        })
        diagResults.items_probe = { status: r1.statusCode, json: r1.json }
      } catch (e1) {
        diagResults.items_probe = { error: String(e1) }
      }

      // 2. GET /items/{probeTarget}/price_to_win?siteId=MLB&version=v2
      try {
        const r2 = $http.send({
          url:
            'https://api.mercadolibre.com/items/' +
            probeTarget +
            '/price_to_win?siteId=MLB&version=v2',
          method: 'GET',
          headers: authHeaders,
          timeout: 10,
        })
        diagResults.price_to_win = { status: r2.statusCode, json: r2.json }
      } catch (e2) {
        diagResults.price_to_win = { error: String(e2) }
      }

      // 3. GET /products/{probeCatalog}
      try {
        const r3 = $http.send({
          url: 'https://api.mercadolibre.com/products/' + probeCatalog,
          method: 'GET',
          headers: authHeaders,
          timeout: 10,
        })
        diagResults.product_catalog = { status: r3.statusCode, json: r3.json }
      } catch (e3) {
        diagResults.product_catalog = { error: String(e3) }
      }

      // 4. GET /products/{probeCatalog}/items
      try {
        const r4 = $http.send({
          url: 'https://api.mercadolibre.com/products/' + probeCatalog + '/items',
          method: 'GET',
          headers: authHeaders,
          timeout: 10,
        })
        diagResults.product_items = { status: r4.statusCode, json: r4.json }
      } catch (e4) {
        diagResults.product_items = { error: String(e4) }
      }

      // 5. GET /products/{probeCatalog}/competition ou /price_to_win
      try {
        const r5 = $http.send({
          url: 'https://api.mercadolibre.com/products/' + probeCatalog + '/price_to_win',
          method: 'GET',
          headers: authHeaders,
          timeout: 10,
        })
        diagResults.product_price_to_win = { status: r5.statusCode, json: r5.json }
      } catch (e5) {
        diagResults.product_price_to_win = { error: String(e5) }
      }

      // 6. GET /sites/MLB/search?catalog_product_id={probeCatalog}
      try {
        const r6 = $http.send({
          url: 'https://api.mercadolibre.com/sites/MLB/search?catalog_product_id=' + probeCatalog,
          method: 'GET',
          headers: authHeaders,
          timeout: 10,
        })
        diagResults.search_catalog_product_id = { status: r6.statusCode, json: r6.json }
      } catch (e6) {
        diagResults.search_catalog_product_id = { error: String(e6) }
      }

      job.set('status', 'done')
      job.set('status_code', 200)
      job.set('result_data', diagResults)
      $app.save(job)
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
