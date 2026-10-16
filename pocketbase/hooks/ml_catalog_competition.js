// Endpoint para consultar concorrência detalhada e itens disputando uma posição de catálogo
// Route: GET /api/ml/catalog-competition/{catalog_product_id}
// Permite que o frontend consulte ou atualize sob demanda a lista de concorrentes,
// com nicknames dos vendedores, preços, estoques e status de Buy Box.

routerAdd('GET', '/backend/v1/ml/catalog-competition/{catalog_product_id}', (e) => {
  let catId = (e.request.pathValue('catalog_product_id') || '').trim()
  if (!catId) {
    const rawUrl = e.request.url ? e.request.url.path || '' : ''
    const match = rawUrl.match(
      /(?:\/backend\/v1\/ml\/catalog-competition|\/api\/ml\/catalog-competition)\/([^/?#]+)/,
    )
    if (match && match[1]) {
      catId = match[1].trim()
    }
  }

  if (!catId) {
    return e.json(400, { error: 'ID da posição de catálogo não informado' })
  }

  // Determinar tenant solicitante para isolamento estrito
  let reqTenant = ''
  try {
    if (e.request) {
      reqTenant = e.request.header.get('x-tenant-id') || ''
      if (!reqTenant && e.request.url) {
        reqTenant = e.request.url.query().get('tenant_id') || ''
      }
    }
  } catch (_) {}

  let authRecord = e.auth
  if (!authRecord) {
    try {
      const info = e.requestInfo()
      authRecord = info.auth
    } catch (_) {}
  }
  const role = authRecord ? authRecord.getString('role') : ''
  const isSuperAdmin = role === 'super_admin'
  const userTenant = authRecord ? authRecord.getString('tenant_id') : ''

  let effectiveTenantId = ''
  if (isSuperAdmin && reqTenant) {
    effectiveTenantId = reqTenant.trim()
  } else if (userTenant) {
    effectiveTenantId = userTenant.trim()
  } else if (reqTenant) {
    effectiveTenantId = reqTenant.trim()
  }

  // Obter token e seller_id de ml_settings para o tenant ativo (sem fallback mestre)
  let token = ''
  let ownSellerId = ''
  try {
    if (effectiveTenantId) {
      const sRecords = $app.findRecordsByFilter(
        'ml_settings',
        'tenant_id = {:tid}',
        '-created',
        1,
        0,
        { tid: effectiveTenantId },
      )
      if (sRecords && sRecords.length > 0) {
        const s = sRecords[0]
        token = s.getString('access_token') || ''
        ownSellerId = s.getString('user_id_ml') || ''
        const refreshToken = s.getString('refresh_token') || ''
        const clientId = s.getString('client_id') || ''
        const clientSecret = s.getString('client_secret') || ''
        const expiresAtRaw = s.getString('token_expires_at') || ''

        let isExpiringSoon = false
        if (expiresAtRaw) {
          try {
            const expTime = new Date(expiresAtRaw.replace(' ', 'T')).getTime()
            if (!isNaN(expTime) && expTime - Date.now() < 10 * 60 * 1000) {
              isExpiringSoon = true
            }
          } catch (_) {}
        } else {
          isExpiringSoon = true
        }

        if ((!token || isExpiringSoon) && refreshToken && clientId && clientSecret) {
          try {
            const refreshRes = $http.send({
              url: 'https://api.mercadolibre.com/oauth/token',
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Accept: 'application/json',
              },
              body:
                'grant_type=refresh_token&client_id=' +
                encodeURIComponent(clientId) +
                '&client_secret=' +
                encodeURIComponent(clientSecret) +
                '&refresh_token=' +
                encodeURIComponent(refreshToken),
              timeout: 15,
            })
            if (refreshRes.statusCode === 200 && refreshRes.json && refreshRes.json.access_token) {
              token = refreshRes.json.access_token
              s.set('access_token', token)
              if (refreshRes.json.refresh_token) {
                s.set('refresh_token', refreshRes.json.refresh_token)
              }
              if (refreshRes.json.expires_in) {
                const newExp = new Date(Date.now() + Number(refreshRes.json.expires_in) * 1000)
                s.set('token_expires_at', newExp.toISOString().replace('T', ' ').substring(0, 19))
              }
              $app.save(s)
            }
          } catch (refErr) {
            console.log('[ml_catalog_competition] Erro renovação token: ' + refErr)
          }
        }
      }
    }
  } catch (errSet) {
    console.log(
      '[ml_catalog_competition] Erro ml_settings para tenant ' + effectiveTenantId + ': ' + errSet,
    )
  }
  const sellerNickCache = {}
  function getSellerNickname(sellerId) {
    if (!sellerId) return ''
    const sIdStr = String(sellerId).trim()
    if (!sIdStr) return ''
    if (sellerNickCache[sIdStr]) return sellerNickCache[sIdStr]

    // Se for o sellerId da própria conta do usuário
    if (ownSellerId && sIdStr === String(ownSellerId).trim()) {
      sellerNickCache[sIdStr] = 'INFOPRECOBAIXO'
      return 'INFOPRECOBAIXO'
    }

    // 1. Tentar ler do cache persistente do banco
    try {
      const cached = $app.findFirstRecordByData('ml_seller_cache', 'seller_id', sIdStr)
      if (cached && cached.getString('nickname')) {
        const nick = cached.getString('nickname').trim()
        if (nick) {
          sellerNickCache[sIdStr] = nick
          return nick
        }
      }
    } catch (_) {}
    try {
      const compRec = $app.findFirstRecordByData('ml_competitors', 'seller_id', sIdStr)
      if (compRec && compRec.getString('nickname')) {
        const nick = compRec.getString('nickname').trim()
        if (nick) {
          sellerNickCache[sIdStr] = nick
          return nick
        }
      }
    } catch (_) {}

    // 2. Se não estiver no cache do banco, consultar API do Mercado Livre /users/{id}
    try {
      const uRes = $http.send({
        url: 'https://api.mercadolibre.com/users/' + sIdStr,
        method: 'GET',
        headers: { Accept: 'application/json' },
        timeout: 4,
      })
      if (uRes.statusCode === 200 && uRes.json && uRes.json.nickname) {
        const nick = String(uRes.json.nickname).trim()
        sellerNickCache[sIdStr] = nick

        // Salvar no cache persistente
        try {
          const sCacheCol = $app.findCollectionByNameOrId('ml_seller_cache')
          if (sCacheCol) {
            const newCacheRec = new Record(sCacheCol)
            newCacheRec.set('seller_id', sIdStr)
            newCacheRec.set('nickname', nick)
            if (uRes.json.permalink) {
              newCacheRec.set('permalink', String(uRes.json.permalink).trim())
            }
            $app.save(newCacheRec)
          }
        } catch (_) {}

        return nick
      }
    } catch (_) {}

    // Fallback: nunca retornar string vazia para seller_id válido
    return 'Vendedor #' + sIdStr
  }

  const headers = { Accept: 'application/json' }
  if (token) {
    headers['Authorization'] = 'Bearer ' + token
  }

  // Helper para extrair sold_quantity
  function extractSoldQuantity(obj) {
    if (!obj) return null
    if (obj.sold_quantity != null && !isNaN(Number(obj.sold_quantity))) {
      return Number(obj.sold_quantity)
    }
    if (obj.sold_quantity_mercadopago != null && !isNaN(Number(obj.sold_quantity_mercadopago))) {
      return Number(obj.sold_quantity_mercadopago)
    }
    if (Array.isArray(obj.attributes)) {
      for (let a = 0; a < obj.attributes.length; a++) {
        const attr = obj.attributes[a]
        if (!attr || !attr.id) continue
        const attrIdUpper = String(attr.id).toUpperCase()
        if (
          attrIdUpper === 'SOLD_QUANTITY' ||
          attrIdUpper === 'TOTAL_SOLD' ||
          attrIdUpper === 'ITEMS_SOLD'
        ) {
          const valNum = Number(attr.value_name || attr.value_id)
          if (!isNaN(valNum)) return valNum
        }
      }
    }
    return null
  }

  // 1. Consultar /products/{id}/items
  let itemsUrl = 'https://api.mercadolibre.com/products/' + encodeURIComponent(catId) + '/items'
  let competitorsList = []
  let bestCompetitor = null
  let suggestedPrice = null
  let competitionRawStatus = ''
  let ownItemId = null
  let maxItemSoldQuantity = null

  try {
    let itRes = $http.send({
      url: itemsUrl,
      method: 'GET',
      headers: headers,
      timeout: 10,
    })

    // Se retornar 401 Unauthorized (token expirado), refazer sem header Authorization (endpoint público)
    if (itRes && itRes.statusCode === 401) {
      itRes = $http.send({
        url: itemsUrl,
        method: 'GET',
        headers: { Accept: 'application/json' },
        timeout: 10,
      })
    }

    if (itRes.statusCode === 200 && itRes.json) {
      const rawList = Array.isArray(itRes.json)
        ? itRes.json
        : Array.isArray(itRes.json.results)
          ? itRes.json.results
          : []

      for (let i = 0; i < rawList.length; i++) {
        const it = rawList[i]
        if (!it) continue
        const itemPrice = Number(it.price || it.original_price || 0)
        const sId = it.seller_id || (it.seller && it.seller.id) || null
        const sNick = (it.seller && it.seller.nickname) || ''
        const sIdStr = sId ? String(sId).trim() : ''
        const isOwn = Boolean(ownSellerId && sIdStr === String(ownSellerId).trim())
        const itSold = extractSoldQuantity(it)
        if (itSold != null && (maxItemSoldQuantity == null || itSold > maxItemSoldQuantity)) {
          maxItemSoldQuantity = itSold
        }

        if (isOwn && it.id) {
          ownItemId = it.id
        }

        const compObj = {
          item_id: it.id || '',
          seller_id: sIdStr,
          seller_nickname: sNick,
          price: itemPrice,
          available_quantity: it.available_quantity != null ? Number(it.available_quantity) : null,
          sold_quantity: itSold,
          listing_type_id: it.listing_type_id || '',
          listing_type_label:
            it.listing_type_id === 'gold_pro' || it.listing_type_id === 'premium'
              ? 'Premium'
              : 'Clássico',
          is_buy_box_winner: Boolean(it.is_buy_box_winner || it.winner || false),
          is_own: isOwn,
        }

        competitorsList.push(compObj)
      }
    }
  } catch (errIt) {
    console.log('[ml_catalog_competition] Erro /products/' + catId + '/items: ' + errIt)
  }

  // 2. Se houver anúncio próprio nesta posição, consultar GET /items/{ownItemId}/price_to_win
  if (ownItemId && token) {
    try {
      const ptwRes = $http.send({
        url:
          'https://api.mercadolibre.com/items/' +
          encodeURIComponent(ownItemId) +
          '/price_to_win?siteId=MLB&version=v2',
        method: 'GET',
        headers: headers,
        timeout: 6,
      })
      if (ptwRes.statusCode === 200 && ptwRes.json) {
        const pj = ptwRes.json
        if (pj.price_to_win != null) {
          suggestedPrice = Number(pj.price_to_win)
        }
        if (pj.status) {
          competitionRawStatus = String(pj.status)
        }
        if (pj.competitor && pj.competitor.price != null) {
          bestCompetitor = {
            item_id: pj.competitor.item_id || null,
            seller_id: pj.competitor.seller_id || null,
            seller_nickname: pj.competitor.seller_nickname || '',
            price: Number(pj.competitor.price),
            stock:
              pj.competitor.available_quantity != null
                ? Number(pj.competitor.available_quantity)
                : null,
            sold_quantity: extractSoldQuantity(pj.competitor),
            listing_type_id: pj.competitor.listing_type_id || '',
          }
        }
      }
    } catch (_) {}
  }

  // Enriquecer nicknames ausentes dos primeiros 15 concorrentes
  for (let cIdx = 0; cIdx < competitorsList.length && cIdx < 15; cIdx++) {
    const c = competitorsList[cIdx]
    if (c && c.seller_id && !c.seller_nickname) {
      c.seller_nickname = getSellerNickname(c.seller_id)
    }
    if (c && c.is_own && !c.seller_nickname) {
      c.seller_nickname = 'INFOPRECOBAIXO'
    }
  }

  // Se o vencedor da Buy Box estiver marcado, enriquecer
  const winner = competitorsList.find((c) => c.is_buy_box_winner)

  // Se nenhum estiver marcado explicitamente como is_buy_box_winner, mas tivermos concorrentes com preço, o menor preço costuma liderar
  let sortedCompetitors = competitorsList.slice().sort((a, b) => {
    if (a.is_buy_box_winner && !b.is_buy_box_winner) return -1
    if (!a.is_buy_box_winner && b.is_buy_box_winner) return 1
    return (a.price || 999999) - (b.price || 999999)
  })

  // Se ainda não tivermos sold_quantity e houver produto de catálogo, tentar ler de /products/{catId}
  let productSoldQuantity = maxItemSoldQuantity
  if (productSoldQuantity == null) {
    try {
      let prodRes = $http.send({
        url: 'https://api.mercadolibre.com/products/' + encodeURIComponent(catId),
        method: 'GET',
        headers: headers,
        timeout: 6,
      })
      if (prodRes && prodRes.statusCode === 401) {
        prodRes = $http.send({
          url: 'https://api.mercadolibre.com/products/' + encodeURIComponent(catId),
          method: 'GET',
          headers: { Accept: 'application/json' },
          timeout: 6,
        })
      }
      if (prodRes && prodRes.statusCode === 200 && prodRes.json) {
        productSoldQuantity = extractSoldQuantity(prodRes.json)
        if (productSoldQuantity == null && prodRes.json.buy_box_winner) {
          productSoldQuantity = extractSoldQuantity(prodRes.json.buy_box_winner)
        }
      }
    } catch (_) {}
  }
  // 3. TENTATIVA HONESTA DE LEITURA DA PÁGINA PÚBLICA (/p/MLB... ou anúncio vencedor)
  // Caso a API retorne null para sold_quantity (muito comum em produtos de catálogo para terceiros),
  // fazemos uma tentativa server-side de captura do contador público ("X vendidos") sem nunca inventar números.
  let publicPageSold = null
  let publicPageStatus = 'not_attempted'

  const publicUrlsToAttempt = []
  if (catId.toUpperCase().startsWith('MLB')) {
    publicUrlsToAttempt.push('https://www.mercadolivre.com.br/p/' + encodeURIComponent(catId))
  }
  if (winner && winner.item_id) {
    publicUrlsToAttempt.push(
      'https://produto.mercadolivre.com.br/' + encodeURIComponent(winner.item_id),
    )
  } else if (sortedCompetitors.length > 0 && sortedCompetitors[0].item_id) {
    publicUrlsToAttempt.push(
      'https://produto.mercadolivre.com.br/' + encodeURIComponent(sortedCompetitors[0].item_id),
    )
  }

  for (let u = 0; u < publicUrlsToAttempt.length && publicPageSold == null; u++) {
    const pUrl = publicUrlsToAttempt[u]
    try {
      const pageRes = $http.send({
        url: pUrl,
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9',
        },
        timeout: 8,
      })

      if (pageRes.statusCode === 200 && pageRes.raw) {
        const body = pageRes.raw
        if (
          body.includes('suspicious-traffic') ||
          body.includes('account-verification') ||
          body.includes('captcha')
        ) {
          publicPageStatus = 'blocked_waf'
          console.log(
            '[ml_catalog_competition] Página pública ' + pUrl + ' bloqueada por WAF/desafio bot.',
          )
          continue
        }

        // Tentar extrair contadores como: "+50 vendidos", "2 vendidos", "5 vendas", "mil vendidos"
        const soldRegex = /\+?\s*([0-9.]+)\s*(?:mil\s*)?(?:vendidos|vendidas|vendas)/i
        const m = body.match(soldRegex)
        if (m && m[1]) {
          let count = parseFloat(m[1].replace(/\./g, ''))
          if (m[0].toLowerCase().includes('mil')) {
            count = count * 1000
          }
          if (!isNaN(count) && count > 0) {
            publicPageSold = Math.round(count)
            publicPageStatus = 'extracted_from_html'
            console.log(
              '[ml_catalog_competition] Sucesso: ' + publicPageSold + ' vendas lidas de ' + pUrl,
            )
            break
          }
        } else {
          // Checar se há JSON preloaded ou ld+json com sold_quantity
          const stateMatch = body.match(/"sold_quantity":\s*([0-9]+)/i)
          if (stateMatch && stateMatch[1]) {
            const count = parseInt(stateMatch[1], 10)
            if (!isNaN(count) && count > 0) {
              publicPageSold = count
              publicPageStatus = 'extracted_from_json_state'
              break
            }
          }
        }
        publicPageStatus = 'no_counter_in_page'
      } else {
        publicPageStatus = 'http_' + pageRes.statusCode
      }
    } catch (ePage) {
      publicPageStatus = 'error: ' + String(ePage)
      console.log('[ml_catalog_competition] Erro scrape ' + pUrl + ': ' + ePage)
    }
  }

  const finalSoldQuantity =
    productSoldQuantity != null
      ? productSoldQuantity
      : publicPageSold != null
        ? publicPageSold
        : null

  // Se o vencedor da posição não tinha sold_quantity, e conseguimos pela página pública, atribui honestamente
  if (winner && winner.sold_quantity == null && publicPageSold != null) {
    winner.sold_quantity = publicPageSold
  }

  return e.json(200, {
    catalog_product_id: catId,
    competitors_count: sortedCompetitors.length,
    competitors: sortedCompetitors,
    winner: winner || (sortedCompetitors.length > 0 ? sortedCompetitors[0] : null),
    suggested_price_to_win: suggestedPrice,
    competition_raw_status: competitionRawStatus,
    best_competitor: bestCompetitor,
    sold_quantity: finalSoldQuantity != null ? Number(finalSoldQuantity) : null,
    public_page_scrape: {
      status: publicPageStatus,
      sold_quantity: publicPageSold,
    },
  })
})

// Endpoint de diagnóstico para validar capacidade de publicação de catálogo no ML
// Route: GET /backend/v1/ml/catalog-diagnose
routerAdd('GET', '/backend/v1/ml/catalog-diagnose', (e) => {
  let catalogProductId = 'MLB49831008'
  if (e.request && e.request.url) {
    catalogProductId = e.request.url.query().get('catalog_product_id') || catalogProductId
  }
  const price = 699
  const quantity = 1
  const condition = 'new'

  const sRecords = $app.findRecordsByFilter(
    'ml_settings',
    'tenant_id = "ambicorpmestre1" || tenant_id = "ambicorp"',
    '-created',
    1,
    0,
  )
  if (!sRecords || sRecords.length === 0) {
    return e.json(404, { error: 'ml_settings não encontrado' })
  }
  const s = sRecords[0]
  const token = s.getString('access_token')
  const clientId = s.getString('client_id')
  const userId = s.getString('user_id_ml')

  const diag = {
    catalog_product_id: catalogProductId,
    user_id_ml: userId,
    client_id: clientId,
    token_prefix: token ? token.substring(0, 15) : '',
    steps: {},
  }

  // 1. GET /products/{id}
  let catDetails = null
  try {
    const pRes = $http.send({
      url: 'https://api.mercadolibre.com/products/' + catalogProductId,
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 10,
    })
    catDetails = pRes.json || {}
    diag.steps.get_product = {
      status: pRes.statusCode,
      name: catDetails.name,
      category_id: catDetails.category_id,
      domain_id: catDetails.domain_id,
      status_cat: catDetails.status,
    }
  } catch (e1) {
    diag.steps.get_product = { error: String(e1) }
  }

  const categoryId = (catDetails && catDetails.category_id) || 'MLB1692'

  // 2. GET /users/me
  try {
    const meRes = $http.send({
      url: 'https://api.mercadolibre.com/users/me',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 8,
    })
    diag.steps.users_me = {
      status: meRes.statusCode,
      id: meRes.json ? meRes.json.id : null,
      nickname: meRes.json ? meRes.json.nickname : null,
      user_type: meRes.json ? meRes.json.user_type : null,
      site_status: meRes.json ? meRes.json.site_status : null,
    }
  } catch (e2) {
    diag.steps.users_me = { error: String(e2) }
  }

  // 2.5 Inspecionar /users/626774396/applications/253167816099623
  try {
    const grantRes = $http.send({
      url: 'https://api.mercadolibre.com/users/' + userId + '/applications/' + clientId,
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 8,
    })
    diag.steps.app_grant = {
      status: grantRes.statusCode,
      body: grantRes.json || grantRes.raw,
    }
  } catch (eg) {
    diag.steps.app_grant = { error: String(eg) }
  }

  // 2.6 Inspecionar /applications/253167816099623
  try {
    const appRes = $http.send({
      url: 'https://api.mercadolibre.com/applications/' + clientId,
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 8,
    })
    diag.steps.app_info = {
      status: appRes.statusCode,
      scopes: appRes.json ? appRes.json.scopes : null,
      name: appRes.json ? appRes.json.name : null,
    }
  } catch (ea) {
    diag.steps.app_info = { error: String(ea) }
  }

  // 2.65 Testar POST /items de catálogo COM title incluído
  const payloadWithTitle = {
    title: (catDetails && catDetails.name) || 'Placa Mae Dell Optiplex Sff 3020 4yp6j Dih81r',
    catalog_product_id: catalogProductId,
    catalog_listing: true,
    category_id: categoryId,
    price: price,
    currency_id: 'BRL',
    available_quantity: quantity,
    buying_mode: 'buy_it_now',
    listing_type_id: 'gold_special',
    condition: condition,
    shipping: { mode: 'me2', local_pick_up: true, free_shipping: price >= 79 },
    sale_terms: [
      { id: 'WARRANTY_TYPE', value_name: 'Garantia do vendedor' },
      { id: 'WARRANTY_TIME', value_name: '90 dias' },
    ],
    attributes: [{ id: 'ITEM_CONDITION', value_id: condition === 'new' ? '2230284' : '2230581' }],
  }
  try {
    const valWithTitleRes = $http.send({
      url: 'https://api.mercadolibre.com/items/validate',
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payloadWithTitle),
      timeout: 8,
    })
    diag.steps.validate_with_title = {
      status: valWithTitleRes.statusCode,
      body: valWithTitleRes.json || valWithTitleRes.raw,
    }
  } catch (eWithTitle) {
    diag.steps.validate_with_title = { error: String(eWithTitle) }
  }

  // 2.7 Buscar um item NÃO-CATÁLOGO (catalog_listing == false) e testar PUT inofensivo nele
  let nonCatalogItemId = ''
  try {
    const uItemsRes = $http.send({
      url: 'https://api.mercadolibre.com/users/' + userId + '/items/search?limit=50&status=active',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 8,
    })
    if (uItemsRes.statusCode === 200 && uItemsRes.json && uItemsRes.json.results) {
      const ids = uItemsRes.json.results
      // Multiget dos primeiros 10 para achar um non-catalog
      const mgRes = $http.send({
        url: 'https://api.mercadolibre.com/items?ids=' + ids.slice(0, 10).join(','),
        method: 'GET',
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
        timeout: 8,
      })
      if (mgRes.statusCode === 200 && Array.isArray(mgRes.json)) {
        for (let m = 0; m < mgRes.json.length; m++) {
          const itB = mgRes.json[m].body
          if (itB && itB.id && !itB.catalog_listing) {
            nonCatalogItemId = itB.id
            break
          }
        }
      }
    }
  } catch (_) {}

  if (nonCatalogItemId) {
    try {
      const itemGet = $http.send({
        url: 'https://api.mercadolibre.com/items/' + nonCatalogItemId,
        method: 'GET',
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
        timeout: 8,
      })
      const curStock = (itemGet.json && itemGet.json.available_quantity) || 1
      const putRes = $http.send({
        url: 'https://api.mercadolibre.com/items/' + nonCatalogItemId,
        method: 'PUT',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ available_quantity: curStock }),
        timeout: 8,
      })
      diag.steps.test_non_catalog_put = {
        item_id: nonCatalogItemId,
        put_status: putRes.statusCode,
        put_body: putRes.json || putRes.raw,
      }
    } catch (ePutNc) {
      diag.steps.test_non_catalog_put = { error: String(ePutNc) }
    }
  }

  // 2.8 Testar POST /items NÃO-CATÁLOGO (anúncio tradicional na mesma categoria) via validate
  const nonCatPayload = {
    title: 'Item Teste Validacao Diagnostico Nao Publicar',
    category_id: 'MLB1692',
    price: 699,
    currency_id: 'BRL',
    available_quantity: 1,
    buying_mode: 'buy_it_now',
    listing_type_id: 'gold_special',
    condition: 'used',
    pictures: [{ source: 'https://http2.mlstatic.com/D_NQ_NP_609309-MLB7566367408_042024-O.webp' }],
    attributes: [{ id: 'ITEM_CONDITION', value_id: '2230581' }],
  }
  try {
    const valNcRes = $http.send({
      url: 'https://api.mercadolibre.com/items/validate',
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(nonCatPayload),
      timeout: 8,
    })
    diag.steps.validate_non_catalog = {
      status: valNcRes.statusCode,
      headers: valNcRes.headers,
      body: valNcRes.json || valNcRes.raw,
    }
  } catch (eValNc) {
    diag.steps.validate_non_catalog = { error: String(eValNc) }
  }

  // 3. Montar payload do anúncio
  const payload = {
    catalog_product_id: catalogProductId,
    catalog_listing: true,
    category_id: categoryId,
    price: price,
    currency_id: 'BRL',
    available_quantity: quantity,
    buying_mode: 'buy_it_now',
    listing_type_id: 'gold_special',
    condition: condition,
    shipping: { mode: 'me2', local_pick_up: true, free_shipping: price >= 79 },
    sale_terms: [
      { id: 'WARRANTY_TYPE', value_name: 'Garantia do vendedor' },
      { id: 'WARRANTY_TIME', value_name: '90 dias' },
    ],
    attributes: [{ id: 'ITEM_CONDITION', value_id: condition === 'new' ? '2230284' : '2230581' }],
  }

  // 4. POST /items/validate
  try {
    const vRes = $http.send({
      url: 'https://api.mercadolibre.com/items/validate',
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      timeout: 10,
    })
    diag.steps.validate = {
      status: vRes.statusCode,
      headers: vRes.headers,
      body: vRes.json || vRes.raw,
    }
  } catch (e3) {
    diag.steps.validate = { error: String(e3) }
  }

  // 5. Testar POST /items direto e inspecionar headers x-policy-agent-action, etc.
  try {
    const postRes = $http.send({
      url: 'https://api.mercadolibre.com/items',
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      timeout: 12,
    })
    diag.steps.post_items = {
      status: postRes.statusCode,
      headers: postRes.headers,
      body: postRes.json || postRes.raw,
    }
  } catch (e4) {
    diag.steps.post_items = { error: String(e4) }
  }

  return e.json(200, diag)
})
