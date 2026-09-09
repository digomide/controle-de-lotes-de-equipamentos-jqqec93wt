// Endpoint para resolução em lote de nomes/nicknames de vendedores do Mercado Livre
// Route: POST /backend/v1/ml/resolve-sellers
// Recebe { seller_ids: ['123', '456'] }
// Retorna { sellers: { '123': 'NICKNAME_1', '456': 'NICKNAME_2' } }
// Usa o cache persistente no banco (ml_seller_cache e ml_competitors) e consulta /users/{id} apenas para os faltantes.

routerAdd('POST', '/backend/v1/ml/resolve-sellers', (e) => {
  let body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (_) {
    body = {}
  }

  let sellerIds = body.seller_ids || body.sellerIds || []
  if (!Array.isArray(sellerIds)) {
    sellerIds = [sellerIds]
  }

  // Sanitizar e deduplicar IDs
  const cleanIds = []
  const seen = {}
  for (let i = 0; i < sellerIds.length; i++) {
    const raw = String(sellerIds[i] || '').trim()
    if (raw && !seen[raw] && !raw.startsWith('nick_') && raw !== 'unknown_seller') {
      seen[raw] = true
      cleanIds.push(raw)
    }
  }

  if (cleanIds.length === 0) {
    return e.json(200, { sellers: {} })
  }

  // Limite razoável por lote para proteger tempos de resposta
  const MAX_PER_BATCH = 50
  const targetIds = cleanIds.slice(0, MAX_PER_BATCH)

  // Identificar conta própria
  let ownSellerId = ''
  try {
    const sRecords = $app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (sRecords && sRecords.length > 0) {
      ownSellerId = sRecords[0].getString('user_id_ml') || ''
    }
  } catch (_) {}

  const result = {}
  const missingFromDb = []

  // 1. Resolver em lote a partir do banco de dados (ml_seller_cache e ml_competitors)
  for (let i = 0; i < targetIds.length; i++) {
    const sId = targetIds[i]
    if (ownSellerId && sId === String(ownSellerId).trim()) {
      result[sId] = 'INFOPRECOBAIXO'
      continue
    }

    let foundNick = ''
    try {
      const cached = $app.findFirstRecordByData('ml_seller_cache', 'seller_id', sId)
      if (cached && cached.getString('nickname')) {
        foundNick = cached.getString('nickname').trim()
      }
    } catch (_) {}

    if (!foundNick) {
      try {
        const compRec = $app.findFirstRecordByData('ml_competitors', 'seller_id', sId)
        if (compRec && compRec.getString('nickname')) {
          foundNick = compRec.getString('nickname').trim()
        }
      } catch (_) {}
    }

    if (foundNick) {
      result[sId] = foundNick
    } else {
      missingFromDb.push(sId)
    }
  }

  // 2. Para os IDs não encontrados no banco, consultar a API do Mercado Livre /users/{id}
  // Limitar a no máximo 15 consultas externas por requisição para evitar latência
  const MAX_API_CALLS = 15
  const apiCandidates = missingFromDb.slice(0, MAX_API_CALLS)

  const sCacheCol = (function () {
    try {
      return $app.findCollectionByNameOrId('ml_seller_cache')
    } catch (_) {
      return null
    }
  })()

  for (let i = 0; i < apiCandidates.length; i++) {
    const sId = apiCandidates[i]
    try {
      const uRes = $http.send({
        url: 'https://api.mercadolibre.com/users/' + encodeURIComponent(sId),
        method: 'GET',
        headers: { Accept: 'application/json' },
        timeout: 3,
      })

      if (uRes.statusCode === 200 && uRes.json && uRes.json.nickname) {
        const nick = String(uRes.json.nickname).trim()
        result[sId] = nick

        // Salvar no cache persistente
        if (sCacheCol) {
          try {
            const newCacheRec = new Record(sCacheCol)
            newCacheRec.set('seller_id', sId)
            newCacheRec.set('nickname', nick)
            if (uRes.json.permalink) {
              newCacheRec.set('permalink', String(uRes.json.permalink).trim())
            }
            $app.save(newCacheRec)
          } catch (_) {}
        }
      }
    } catch (_) {}
  }

  return e.json(200, {
    sellers: result,
    resolved_count: Object.keys(result).length,
    requested_count: targetIds.length,
  })
})
