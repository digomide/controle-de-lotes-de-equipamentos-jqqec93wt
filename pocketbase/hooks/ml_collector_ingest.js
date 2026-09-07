// Hook de ingestão para o Coletor do Mercado Livre (Userscript Tampermonkey e Coletor Turbo)
// Endpoint: POST /api/ml-collector/ingest
// Suporta CORS completo (OPTIONS preflight + POST com headers CORS)
// Valida chave de coleta em ml_collector_keys ou Authorization Bearer
// Salva os dados em ml_collector_imports com notes indicando a origem (auto / turbo / manual)
// Todas as funções são mantidas INLINE dentro de cada callback para respeitar a VM pool do Goja/PocketBase v0.36

routerAdd('OPTIONS', '/api/ml-collector/ingest', (e) => {
  try {
    const res = e.response
    if (res && res.header) {
      res.header().set('Access-Control-Allow-Origin', '*')
      res.header().set('Access-Control-Allow-Methods', 'POST, OPTIONS, GET')
      res
        .header()
        .set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Collector-Key')
    }
  } catch (_) {}
  return e.noContent(204)
})

routerAdd('GET', '/api/ml-collector/ingest', (e) => {
  try {
    const res = e.response
    if (res && res.header) {
      res.header().set('Access-Control-Allow-Origin', '*')
      res.header().set('Access-Control-Allow-Methods', 'POST, OPTIONS, GET')
      res
        .header()
        .set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Collector-Key')
    }
  } catch (_) {}
  return e.json(200, {
    status: 'ok',
    message: 'ML Collector Ingestion Endpoint is active. Send POST with JSON payload.',
  })
})

routerAdd('POST', '/api/ml-collector/ingest', (e) => {
  try {
    const res = e.response
    if (res && res.header) {
      res.header().set('Access-Control-Allow-Origin', '*')
      res.header().set('Access-Control-Allow-Methods', 'POST, OPTIONS, GET')
      res
        .header()
        .set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Collector-Key')
    }
  } catch (_) {}

  let body = {}
  try {
    const info = e.requestInfo()
    body = info.body || {}
  } catch (err) {
    return e.json(400, {
      ok: false,
      error: 'JSON malformado ou corpo vazio: ' + (err.message || err),
    })
  }

  // 1. Obter e validar a chave de coleta
  // Pode vir no header X-Collector-Key, no Authorization (Bearer <key>), ou na query string ?key=..., ou no body.key / body.collector_key
  const reqInfo = e.requestInfo()
  const headers = reqInfo.headers || {}
  const query = reqInfo.query || {}

  let collectorKey = (
    headers['x-collector-key'] ||
    headers['X-Collector-Key'] ||
    query.key ||
    body.collector_key ||
    body.key ||
    ''
  )
    .toString()
    .trim()

  const authHeader = (headers.authorization || headers.Authorization || '').toString().trim()
  if (!collectorKey && authHeader.toLowerCase().startsWith('bearer ')) {
    collectorKey = authHeader.substring(7).trim()
  }

  // Se não foi informada chave, verificar se há uma sessão de usuário autenticado no PocketBase
  let isAuthorized = false
  let keyRecord = null

  if (collectorKey) {
    try {
      const records = $app.findRecordsByFilter(
        'ml_collector_keys',
        "key = '" + collectorKey.replace(/'/g, "\\'") + "' && active = true",
        '',
        1,
        0,
      )
      if (records && records.length > 0) {
        isAuthorized = true
        keyRecord = records[0]
      }
    } catch (kErr) {
      console.log('[ml_collector_ingest] Erro ao buscar chave: ' + kErr)
    }
  }

  if (!isAuthorized && e.auth) {
    // Usuário autenticado diretamente no app
    isAuthorized = true
  }

  if (!isAuthorized) {
    return e.json(401, {
      ok: false,
      error:
        'Chave de coleta inválida ou ausente. Forneça o header X-Collector-Key ou configure sua chave.',
    })
  }

  // 2. Processar os dados recebidos
  const payload = body.payload || body
  let results = []
  if (Array.isArray(payload.results)) {
    results = payload.results
  } else if (Array.isArray(body.results)) {
    results = body.results
  } else if (Array.isArray(payload)) {
    results = payload
  }

  if (!results || results.length === 0) {
    return e.json(400, {
      ok: false,
      error:
        'Nenhum anúncio encontrado no payload. Formato esperado: { search_term, results: [...] }',
    })
  }

  const rawSearchTerm = (body.search_term || payload.search_term || '').toString().trim()
  const sourceUrl = (body.source_url || payload.source_url || '').toString().trim()
  const sourceNotes = (body.notes || body.source || payload.notes || 'auto').toString().trim()

  // Normalização do termo de busca
  let searchTerm = rawSearchTerm.toLowerCase().replace(/\s+/g, ' ')
  if (!searchTerm && sourceUrl) {
    const urlMatch = sourceUrl.match(/lista\.mercadolivre\.com\.br\/([^?#]+)/)
    if (urlMatch) {
      try {
        searchTerm = decodeURIComponent(urlMatch[1]).replace(/-/g, ' ').toLowerCase().trim()
      } catch (_) {}
    }
  }

  if (!searchTerm) {
    return e.json(400, {
      ok: false,
      error: 'Termo de busca não identificado. Informe search_term no JSON.',
    })
  }

  // Contagem de itens com vendas
  let withSalesCount = 0
  for (let i = 0; i < results.length; i++) {
    const item = results[i]
    if (item && item.sold_quantity != null && Number(item.sold_quantity) > 0) {
      withSalesCount++
    }
  }

  const compiledPayload = {
    version: payload.version || '1.1.0',
    source_url: sourceUrl,
    collected_at: payload.collected_at || new Date().toISOString(),
    search_term: searchTerm,
    results_count: results.length,
    with_sales_count: withSalesCount,
    source: sourceNotes, // 'auto' | 'turbo' | 'manual'
    results: results,
  }

  try {
    const importsCol = $app.findCollectionByNameOrId('ml_collector_imports')
    const importRecord = new Record(importsCol)
    importRecord.set('search_term', searchTerm)
    importRecord.set('source_url', sourceUrl)
    importRecord.set('imported_at', new Date().toISOString())
    importRecord.set('payload', compiledPayload)
    importRecord.set('results_count', results.length)
    importRecord.set('with_sales_count', withSalesCount)
    importRecord.set('notes', sourceNotes)

    $app.save(importRecord)

    // Atualizar last_used_at na chave se houver
    if (keyRecord) {
      try {
        keyRecord.set('last_used_at', new Date().toISOString())
        $app.save(keyRecord)
      } catch (_) {}
    }

    console.log(
      '[ml_collector_ingest] Coleta gravada com sucesso! Termo: "' +
        searchTerm +
        '", Anúncios: ' +
        results.length +
        ', Com vendas: ' +
        withSalesCount +
        ', Origem: ' +
        sourceNotes,
    )

    return e.json(200, {
      ok: true,
      id: importRecord.id,
      search_term: searchTerm,
      results_count: results.length,
      with_sales_count: withSalesCount,
      notes: sourceNotes,
      message: 'Coleta gravada com sucesso e vinculada ao Raio-X!',
    })
  } catch (saveErr) {
    console.log('[ml_collector_ingest] Erro ao salvar coleta: ' + saveErr)
    return e.json(500, {
      ok: false,
      error: 'Erro ao gravar coleta no banco de dados: ' + (saveErr.message || saveErr),
    })
  }
})
