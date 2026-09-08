// Hook de ingestão e segurança para o Coletor do Mercado Livre (Userscript Tampermonkey, Coletor Turbo e Coletor Manual)
//
// 1. MECANISMO PRINCIPAL (API padrão de coleções - 100% suportada no Skip Cloud / PocketBase v0.36):
//    Intercepta requisições de criação para a coleção ml_collector_imports:
//    POST /api/collections/ml_collector_imports/records
//    Valida a chave informada via header X-Collector-Key (ou Authorization Bearer / body.key) contra ml_collector_keys.
//    Se válida, autoriza e calcula estatísticas complementares.
//    Se inválida e sem sessão auth válida, bloqueia imediatamente com UnauthorizedError (HTTP 401).
//
// 2. MECANISMO SECUNDÁRIO (routerAdd atualizado para v0.23+/v0.36):
//    Registra também routerAdd('POST', '/api/ml-collector/ingest', (e) => ...) caso o router passe a responder.

// Helper compartilhado para extrair e validar a chave em ml_collector_keys
function validateCollectorAccess(reqInfo, authRecord) {
  var headers = (reqInfo && reqInfo.headers) || {}
  var query = (reqInfo && reqInfo.query) || {}
  var body = (reqInfo && reqInfo.body) || {}

  var collectorKey = (
    headers['x-collector-key'] ||
    headers['X-Collector-Key'] ||
    headers['x_collector_key'] ||
    query.key ||
    body.collector_key ||
    body.key ||
    ''
  )
    .toString()
    .trim()

  var authHeader = (headers.authorization || headers.Authorization || '').toString().trim()
  if (!collectorKey && authHeader.toLowerCase().indexOf('bearer ') === 0) {
    collectorKey = authHeader.substring(7).trim()
  }

  var isAuthorized = false
  var keyRecord = null

  if (collectorKey) {
    try {
      var records = $app.findRecordsByFilter(
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
      console.log('[ml_collector_ingest] Erro ao consultar ml_collector_keys: ' + kErr)
    }
  }

  // Se não foi informada chave de coletor, mas há usuário autenticado no PocketBase (ex: admin ou operador no painel)
  if (!isAuthorized && authRecord) {
    isAuthorized = true
  }

  return {
    isAuthorized: isAuthorized,
    keyRecord: keyRecord,
    collectorKey: collectorKey,
  }
}

// ------------------------------------------------------------------------------------------------
// 1. Interceptor de criação na coleção ml_collector_imports (API Padrão)
//    Rota nativa do PocketBase: POST /api/collections/ml_collector_imports/records
// ------------------------------------------------------------------------------------------------
try {
  if (typeof onRecordCreateRequest === 'function') {
    onRecordCreateRequest((e) => {
      // Ignora para superusers
      if (e.hasSuperuserAuth && e.hasSuperuserAuth()) {
        return e.next()
      }

      var reqInfo = e.requestInfo ? e.requestInfo() : null
      var auth = e.auth || (reqInfo && reqInfo.auth)
      var authValidation = validateCollectorAccess(reqInfo, auth)

      if (!authValidation.isAuthorized) {
        throw new UnauthorizedError(
          'Chave de coleta inválida ou ausente. Forneça o header X-Collector-Key ativo.',
        )
      }

      // Normalizar campos e estatísticas do registro sendo inserido
      var record = e.record
      if (record) {
        var searchTerm = (record.getString('search_term') || '')
          .toLowerCase()
          .replace(/\s+/g, ' ')
          .trim()
        var sourceUrl = (record.getString('source_url') || '').trim()

        if (!searchTerm && sourceUrl) {
          var urlMatch = sourceUrl.match(/lista\.mercadolivre\.com\.br\/([^?#]+)/)
          if (urlMatch) {
            try {
              searchTerm = decodeURIComponent(urlMatch[1]).replace(/-/g, ' ').toLowerCase().trim()
            } catch (_) {}
          }
        }

        if (searchTerm) {
          record.set('search_term', searchTerm)
        }

        if (!record.getString('imported_at')) {
          record.set('imported_at', new Date().toISOString())
        }

        // Se payload fornecido, calcular results_count e with_sales_count se não vierem preenchidos
        try {
          var rawPayload = record.get('payload')
          if (typeof rawPayload === 'string') {
            try {
              rawPayload = JSON.parse(rawPayload)
            } catch (_) {}
          }
          if (rawPayload && typeof rawPayload === 'object') {
            var results = Array.isArray(rawPayload.results)
              ? rawPayload.results
              : Array.isArray(rawPayload)
                ? rawPayload
                : []

            if (record.getInt('results_count') === 0 && results.length > 0) {
              record.set('results_count', results.length)
            }

            if (record.getInt('with_sales_count') === 0 && results.length > 0) {
              var salesCount = 0
              for (var i = 0; i < results.length; i++) {
                var it = results[i]
                if (it && it.sold_quantity != null && Number(it.sold_quantity) > 0) {
                  salesCount++
                }
              }
              record.set('with_sales_count', salesCount)
            }
          }
        } catch (_) {}
      }

      // Atualizar timestamp da chave utilizada
      if (authValidation.keyRecord) {
        try {
          authValidation.keyRecord.set('last_used_at', new Date().toISOString())
          $app.save(authValidation.keyRecord)
        } catch (_) {}
      }

      console.log(
        '[ml_collector_ingest] Ingestão via API padrão autorizada para o termo: "' +
          (record ? record.getString('search_term') : '') +
          '" (resultados: ' +
          (record ? record.getInt('results_count') : 0) +
          ', com vendas: ' +
          (record ? record.getInt('with_sales_count') : 0) +
          ')',
      )

      return e.next()
    }, 'ml_collector_imports')
  }
} catch (hookErr) {
  console.log('[ml_collector_ingest] Falha ao registrar onRecordCreateRequest: ' + hookErr)
}

// Fallback no hook onRecordCreate para garantir normalização e integridade
onRecordCreate((e) => {
  var record = e.record
  if (!record) {
    return e.next()
  }

  var rawTerm = record.getString('search_term')
  if (rawTerm) {
    var cleanTerm = rawTerm.toLowerCase().replace(/\s+/g, ' ').trim()
    if (cleanTerm !== rawTerm) {
      record.set('search_term', cleanTerm)
    }
  }

  if (!record.getString('imported_at')) {
    record.set('imported_at', new Date().toISOString())
  }

  return e.next()
}, 'ml_collector_imports')

// ------------------------------------------------------------------------------------------------
// 2. Rota personalizada routerAdd mantida com sintaxe moderna v0.23+/v0.36
// ------------------------------------------------------------------------------------------------
routerAdd('OPTIONS', '/backend/v1/ml-collector/ingest', (e) => {
  try {
    var res = e.response
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

routerAdd('GET', '/backend/v1/ml-collector/ingest', (e) => {
  try {
    var res = e.response
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

routerAdd('POST', '/backend/v1/ml-collector/ingest', (e) => {
  try {
    var res = e.response
    if (res && res.header) {
      res.header().set('Access-Control-Allow-Origin', '*')
      res.header().set('Access-Control-Allow-Methods', 'POST, OPTIONS, GET')
      res
        .header()
        .set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Collector-Key')
    }
  } catch (_) {}

  var body = {}
  try {
    var info = e.requestInfo()
    body = (info && info.body) || {}
  } catch (err) {
    return e.json(400, {
      ok: false,
      error: 'JSON malformado ou corpo vazio: ' + (err.message || err),
    })
  }

  var reqInfo = e.requestInfo()
  var authValidation = validateCollectorAccess(reqInfo, e.auth)

  if (!authValidation.isAuthorized) {
    return e.json(401, {
      ok: false,
      error:
        'Chave de coleta inválida ou ausente. Forneça o header X-Collector-Key ou configure sua chave.',
    })
  }

  // Processar os dados recebidos
  var payload = body.payload || body
  var results = []
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

  var rawSearchTerm = (body.search_term || payload.search_term || '').toString().trim()
  var sourceUrl = (body.source_url || payload.source_url || '').toString().trim()
  var sourceNotes = (body.notes || body.source || payload.notes || 'auto').toString().trim()

  var searchTerm = rawSearchTerm.toLowerCase().replace(/\s+/g, ' ')
  if (!searchTerm && sourceUrl) {
    var urlMatch = sourceUrl.match(/lista\.mercadolivre\.com\.br\/([^?#]+)/)
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

  var withSalesCount = 0
  for (var i = 0; i < results.length; i++) {
    var item = results[i]
    if (item && item.sold_quantity != null && Number(item.sold_quantity) > 0) {
      withSalesCount++
    }
  }

  var compiledPayload = {
    version: payload.version || '1.1.0',
    source_url: sourceUrl,
    collected_at: payload.collected_at || new Date().toISOString(),
    search_term: searchTerm,
    results_count: results.length,
    with_sales_count: withSalesCount,
    source: sourceNotes,
    results: results,
  }

  try {
    var importsCol = $app.findCollectionByNameOrId('ml_collector_imports')
    var importRecord = new Record(importsCol)
    importRecord.set('search_term', searchTerm)
    importRecord.set('source_url', sourceUrl)
    importRecord.set('imported_at', new Date().toISOString())
    importRecord.set('payload', compiledPayload)
    importRecord.set('results_count', results.length)
    importRecord.set('with_sales_count', withSalesCount)
    importRecord.set('notes', sourceNotes)

    $app.save(importRecord)

    if (authValidation.keyRecord) {
      try {
        authValidation.keyRecord.set('last_used_at', new Date().toISOString())
        $app.save(authValidation.keyRecord)
      } catch (_) {}
    }

    console.log(
      '[ml_collector_ingest] Coleta gravada via routerAdd! Termo: "' +
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
