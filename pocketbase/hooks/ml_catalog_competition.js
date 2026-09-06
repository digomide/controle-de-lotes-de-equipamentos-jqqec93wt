// Endpoint para consultar concorrência detalhada e itens disputando uma posição de catálogo
// Route: GET /api/ml/catalog-competition/{catalog_product_id}
// Permite que o frontend consulte ou atualize sob demanda a lista de concorrentes,
// com nicknames dos vendedores, preços, estoques e status de Buy Box.

routerAdd('GET', '/api/ml/catalog-competition/{catalog_product_id}', (e) => {
  let catId = (e.request.pathValue('catalog_product_id') || '').trim()
  if (!catId) {
    const rawUrl = e.request.url ? e.request.url.path || '' : ''
    const match = rawUrl.match(/\/api\/ml\/catalog-competition\/([^/?#]+)/)
    if (match && match[1]) {
      catId = match[1].trim()
    }
  }

  if (!catId) {
    return e.json(400, { error: 'ID da posição de catálogo não informado' })
  }

  // Obter token e seller_id de ml_settings
  let token = ''
  let ownSellerId = ''
  try {
    const sRecords = $app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (sRecords && sRecords.length > 0) {
      token = sRecords[0].getString('access_token') || ''
      ownSellerId = sRecords[0].getString('user_id_ml') || ''
    }
  } catch (errSet) {
    console.log('[ml_catalog_competition] Erro ml_settings: ' + errSet)
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
        return nick
      }
    } catch (_) {}
    return ''
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
    const itRes = $http.send({
      url: itemsUrl,
      method: 'GET',
      headers: headers,
      timeout: 10,
    })

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
  if (productSoldQuantity == null && token) {
    try {
      const prodRes = $http.send({
        url: 'https://api.mercadolibre.com/products/' + encodeURIComponent(catId),
        method: 'GET',
        headers: headers,
        timeout: 6,
      })
      if (prodRes.statusCode === 200 && prodRes.json) {
        productSoldQuantity = extractSoldQuantity(prodRes.json)
        if (productSoldQuantity == null && prodRes.json.buy_box_winner) {
          productSoldQuantity = extractSoldQuantity(prodRes.json.buy_box_winner)
        }
      }
    } catch (_) {}
  }

  return e.json(200, {
    catalog_product_id: catId,
    competitors_count: sortedCompetitors.length,
    competitors: sortedCompetitors,
    winner: winner || (sortedCompetitors.length > 0 ? sortedCompetitors[0] : null),
    suggested_price_to_win: suggestedPrice,
    competition_raw_status: competitionRawStatus,
    best_competitor: bestCompetitor,
    sold_quantity: productSoldQuantity != null ? Number(productSoldQuantity) : null,
  })
})
