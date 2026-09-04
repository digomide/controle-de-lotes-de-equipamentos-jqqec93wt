// Endpoint para obter atributos da categoria do Mercado Livre com cache no servidor (>24h)
// Route: GET /api/ml/category-attributes/:id

routerAdd('GET', '/api/ml/category-attributes/{id}', (e) => {
  const catId = (e.request.pathValue('id') || 'MLB1652').trim()
  if (!catId) {
    return e.json(400, { error: 'ID da categoria não informado' })
  }

  // 1. Verificar se existe no cache e se tem menos de 24 horas
  let cachedRecord = null
  try {
    const list = $app.findRecordsByFilter(
      'ml_category_cache',
      'category_id = {:cat}',
      '-cached_at',
      1,
      0,
      {
        cat: catId,
      },
    )
    if (list && list.length > 0) {
      cachedRecord = list[0]
    }
  } catch (findErr) {
    console.log('[ml_category_hook] Erro ao buscar cache: ' + findErr)
  }

  const now = Date.now()
  const twentyFourHoursMs = 24 * 60 * 60 * 1000

  if (cachedRecord) {
    const cachedAtStr = cachedRecord.getString('cached_at')
    if (cachedAtStr) {
      const cachedTime = new Date(cachedAtStr).getTime()
      if (now - cachedTime < twentyFourHoursMs) {
        const cachedAttrs = cachedRecord.get('attributes')
        if (Array.isArray(cachedAttrs) && cachedAttrs.length > 0) {
          return e.json(200, {
            category_id: catId,
            source: 'cache',
            cached_at: cachedAtStr,
            attributes: cachedAttrs,
          })
        }
      }
    }
  }

  // 2. Se não estiver no cache ou tiver expirado (>24h), buscar da API do Mercado Livre
  // Pegar access_token de ml_settings (ou tentar público, mas usando token salvo se disponível)
  let accessToken = ''
  try {
    const sRecords = $app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (sRecords && sRecords.length > 0) {
      accessToken = sRecords[0].getString('access_token') || ''
    }
  } catch (_) {}

  const headers = {
    Accept: 'application/json',
  }
  if (accessToken) {
    headers['Authorization'] = 'Bearer ' + accessToken
  }

  let mlRes = null
  try {
    mlRes = $http.send({
      url: 'https://api.mercadolibre.com/categories/' + catId + '/attributes',
      method: 'GET',
      headers: headers,
      timeout: 20,
    })
  } catch (netErr) {
    console.log('[ml_category_hook] Erro ao consultar ML API: ' + netErr)
  }

  let attributesData = []
  if (mlRes && mlRes.statusCode === 200 && Array.isArray(mlRes.json)) {
    attributesData = mlRes.json
  }

  // Se a consulta retornou dados com sucesso, salvar/atualizar cache
  if (attributesData.length > 0) {
    try {
      if (cachedRecord) {
        cachedRecord.set('attributes', attributesData)
        cachedRecord.set('cached_at', new Date().toISOString())
        $app.save(cachedRecord)
      } else {
        const col = $app.findCollectionByNameOrId('ml_category_cache')
        const newRec = new Record(col)
        newRec.set('category_id', catId)
        newRec.set('attributes', attributesData)
        newRec.set('cached_at', new Date().toISOString())
        $app.save(newRec)
      }
    } catch (saveErr) {
      console.log('[ml_category_hook] Erro ao salvar cache de atributos: ' + saveErr)
    }

    return e.json(200, {
      category_id: catId,
      source: 'live',
      cached_at: new Date().toISOString(),
      attributes: attributesData,
    })
  }

  // Se falhou ao buscar live mas tínhamos cache expirado anterior, retornar o expirado como contingência
  if (cachedRecord) {
    const prevAttrs = cachedRecord.get('attributes')
    if (Array.isArray(prevAttrs) && prevAttrs.length > 0) {
      return e.json(200, {
        category_id: catId,
        source: 'stale_cache',
        cached_at: cachedRecord.getString('cached_at'),
        attributes: prevAttrs,
      })
    }
  }

  return e.json(502, {
    error: 'Não foi possível obter atributos da categoria ' + catId + ' do Mercado Livre.',
  })
})
