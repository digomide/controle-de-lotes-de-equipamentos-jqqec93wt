// Hook de ingestão e segurança para o Coletor do Mercado Livre (Userscript Tampermonkey, Coletor Turbo e Coletor Manual)
//
// 1. MECANISMO PRINCIPAL:
//    Intercepta requisições de criação para a coleção ml_collector_imports:
//    POST /api/collections/ml_collector_imports/records
//    IMPORTANTE: Apenas chave válida de coletor (X-Collector-Key / Authorization Bearer / query.key / body.key)
//    ou superuser/admin logado autorizam a ingestão. Anônimo sem chave é rejeitado com 401.//
// 2. MECANISMO SECUNDÁRIO:
//    Registra também routerAdd para rotas personalizadas com CORS.

// ------------------------------------------------------------------------------------------------
// 1. Interceptor de criação na coleção ml_collector_imports (API Padrão)
//    Rota nativa do PocketBase: POST /api/collections/ml_collector_imports/records
// ------------------------------------------------------------------------------------------------
try {
  if (typeof onRecordCreateRequest === 'function') {
    onRecordCreateRequest((e) => {
      // Ignora para superusers
      try {
        if (e.hasSuperuserAuth && e.hasSuperuserAuth()) {
          return e.next()
        }
      } catch (_) {}

      var reqInfo = null
      try {
        reqInfo = e.requestInfo ? e.requestInfo() : null
      } catch (_) {}

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
          var safeKey = collectorKey.replace(/'/g, "\\'")
          var records = $app.findRecordsByFilter(
            'ml_collector_keys',
            "key = '" + safeKey + "' && active = true",
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

      // Se não informou chave de coletor, aceita sessão autenticada de usuário (ex: admin no painel)
      var auth = e.auth || (reqInfo && reqInfo.auth)
      if (!isAuthorized && auth && auth.id) {
        isAuthorized = true
      }

      if (!isAuthorized) {
        if (typeof UnauthorizedError === 'function') {
          throw new UnauthorizedError(
            'Chave de coleta inválida ou ausente. Forneça o header X-Collector-Key ativo.',
          )
        }
        if (typeof ApiError === 'function') {
          throw new ApiError(
            401,
            'Chave de coleta inválida ou ausente. Forneça o header X-Collector-Key ativo.',
          )
        }
        var authErr = new Error(
          'Chave de coleta inválida ou ausente. Forneça o header X-Collector-Key ativo.',
        )
        authErr.status = 401
        throw authErr
      }

      // Normalizar campos e estatísticas do registro sendo inserido
      var record = e.record
      if (record) {
        // Garantir preenchimento automático de tenant_id válido
        var currentTenantId = (record.getString('tenant_id') || '').trim()
        if (!currentTenantId) {
          var userTenant =
            auth && auth.getString ? auth.getString('tenant_id') : auth ? auth.tenant_id : ''
          currentTenantId = (userTenant || 'ambicorpmestre1').toString().trim()
          record.set('tenant_id', currentTenantId)
        }

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
        } else {
          // Fallback defensivo para não estourar required
          record.set('search_term', 'coleta mercado livre')
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
      if (keyRecord) {
        try {
          keyRecord.set('last_used_at', new Date().toISOString())
          $app.save(keyRecord)
        } catch (_) {}
      }

      console.log(
        '[ml_collector_ingest] Ingestão via API padrão autorizada para o termo: "' +
          (record ? record.getString('search_term') : '') +
          '" (resultados: ' +
          (record ? record.getInt('results_count') : 0) +
          ', com vendas: ' +
          (record ? record.getInt('with_sales_count') : 0) +
          ', tenant_id: "' +
          (record ? record.getString('tenant_id') : '') +
          '")',
      )

      try {
        return e.next()
      } catch (nextErr) {
        console.log(
          '[ml_collector_ingest] ERRO DETALHADO em onRecordCreateRequest e.next(): ' +
            (nextErr && nextErr.message ? nextErr.message : nextErr) +
            ' | Data: ' +
            JSON.stringify(nextErr && nextErr.data ? nextErr.data : {}) +
            ' | Raw: ' +
            JSON.stringify(nextErr),
        )
        throw nextErr
      }
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

  // Auto-preenchimento defensivo de tenant_id caso não tenha sido preenchido
  var curTenant = (record.getString('tenant_id') || '').trim()
  if (!curTenant) {
    record.set('tenant_id', 'ambicorpmestre1')
  }

  var rawTerm = record.getString('search_term')
  if (rawTerm) {
    var cleanTerm = rawTerm.toLowerCase().replace(/\s+/g, ' ').trim()
    if (cleanTerm !== rawTerm) {
      record.set('search_term', cleanTerm)
    }
  } else {
    record.set('search_term', 'coleta mercado livre')
  }

  if (!record.getString('imported_at')) {
    record.set('imported_at', new Date().toISOString())
  }

  try {
    return e.next()
  } catch (nextErr) {
    console.log(
      '[ml_collector_ingest] ERRO DETALHADO em onRecordCreate e.next(): ' +
        (nextErr && nextErr.message ? nextErr.message : nextErr) +
        ' | Data: ' +
        JSON.stringify(nextErr && nextErr.data ? nextErr.data : {}) +
        ' | Raw: ' +
        JSON.stringify(nextErr),
    )
    throw nextErr
  }
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

  var reqInfo = null
  try {
    reqInfo = e.requestInfo ? e.requestInfo() : null
  } catch (_) {}

  var headers = (reqInfo && reqInfo.headers) || {}
  var query = (reqInfo && reqInfo.query) || {}

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
      var safeKey = collectorKey.replace(/'/g, "\\'")
      var records = $app.findRecordsByFilter(
        'ml_collector_keys',
        "key = '" + safeKey + "' && active = true",
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

  if (!isAuthorized && e.auth && e.auth.id) {
    isAuthorized = true
  }

  if (!isAuthorized) {
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
    importRecord.set('tenant_id', 'ambicorpmestre1')

    $app.save(importRecord)

    if (keyRecord) {
      try {
        keyRecord.set('last_used_at', new Date().toISOString())
        $app.save(keyRecord)
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

// ------------------------------------------------------------------------------------------------
// 3. Rotas públicas/personalizadas para o resumo consolidado do coletor
//    ATENÇÃO: Toda a lógica é estritamente INLINE dentro de cada callback de rota para evitar erros
//    de escopo no runtime JSVM do PocketBase (separate VM pool).
// ------------------------------------------------------------------------------------------------
routerAdd('OPTIONS', '/backend/v1/custom/ml-collector/summary', (e) => {
  try {
    var res = e.response
    if (res && res.header) {
      res.header().set('Access-Control-Allow-Origin', '*')
      res.header().set('Access-Control-Allow-Methods', 'GET, OPTIONS')
      res
        .header()
        .set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Collector-Key')
    }
  } catch (_) {}
  return e.noContent(204)
})

routerAdd('GET', '/backend/v1/custom/ml-collector/summary', (e) => {
  try {
    var res = e.response
    if (res && res.header) {
      res.header().set('Access-Control-Allow-Origin', '*')
      res.header().set('Access-Control-Allow-Methods', 'GET, OPTIONS')
      res
        .header()
        .set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Collector-Key')
    }
  } catch (_) {}

  try {
    var reqInfo = e.requestInfo ? e.requestInfo() : null
    var query = (reqInfo && reqInfo.query) || {}
    var rawTerm = (query.term || query.search_term || '').toString().trim()
    if (!rawTerm) {
      return e.json(400, { ok: false, error: 'Termo de busca (term) é obrigatório' })
    }

    // Helper inline: remoção de acentos NFD
    var removeAccentsInline = function (text) {
      return (text || '')
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
    }

    var genericCategoryWords = {
      notebook: 1,
      notebooks: 1,
      computador: 1,
      computadores: 1,
      laptop: 1,
      laptops: 1,
      pc: 1,
      desktop: 1,
      desktops: 1,
      ultrabook: 1,
      ultrabooks: 1,
    }

    var softenSearchTermInline = function (q) {
      if (!q) return ''
      var words = q.trim().split(/\s+/).filter(Boolean)
      if (words.length < 2) return q.trim()
      var softenedWords = words.filter(function (w) {
        var clean = removeAccentsInline(w)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '')
        return !genericCategoryWords[clean]
      })
      var resSoftened = softenedWords.join(' ').trim()
      return resSoftened && resSoftened.length >= 2 ? resSoftened : q.trim()
    }

    // Normalização (lowercase, sem acentos, sem pontuações supérfluas)
    var term = removeAccentsInline(rawTerm).toLowerCase().trim()
    var softened = removeAccentsInline(softenSearchTermInline(rawTerm)).toLowerCase().trim()

    var bytesToStrInline = function (bytes) {
      if (typeof bytes === 'string') return bytes
      if (!bytes) return ''
      if (Array.isArray(bytes)) {
        var strOut = ''
        var chunk = 8192
        for (var idx = 0; idx < bytes.length; idx += chunk) {
          var slice = bytes.slice(idx, idx + chunk)
          strOut += String.fromCharCode.apply(null, slice)
        }
        try {
          return decodeURIComponent(escape(strOut))
        } catch (_) {
          return strOut
        }
      }
      return ''
    }

    // Excluir termos sujos conhecidos e buscas irrelevantes
    var isDirtyTermInline = function (st) {
      if (!st) return true
      var clean = removeAccentsInline(st).toLowerCase().trim()
      if (clean.length <= 2) return true
      if (
        clean === 'busca mercado livre' ||
        clean === 'busca mercadolivre' ||
        clean === 'mercado livre' ||
        clean === 'mercadolivre' ||
        clean === 'home' ||
        clean === 'pagina inicial' ||
        clean === 'pl'
      ) {
        return true
      }
      return false
    }

    // Componentes de hardware para proteção anti-herança no backend
    var HARDWARE_COMPONENTS_BACKEND = {
      placa: 1,
      placas: 1,
      'placa-mae': 1,
      'placa mae': 1,
      placamae: 1,
      motherboard: 1,
      tela: 1,
      telas: 1,
      display: 1,
      teclado: 1,
      teclados: 1,
      cooler: 1,
      coolers: 1,
      ventoinha: 1,
      fan: 1,
      fonte: 1,
      carcaca: 1,
      carcacas: 1,
      bateria: 1,
      baterias: 1,
      cabo: 1,
      flat: 1,
      touchpad: 1,
      palmrest: 1,
      dobradica: 1,
    }

    var extractCompTokensBackend = function (str) {
      var words = (str || '')
        .toLowerCase()
        .split(/[\s\-_]+/)
        .filter(Boolean)
      var found = []
      for (var wi = 0; wi < words.length; wi++) {
        var w = words[wi]
        if (HARDWARE_COMPONENTS_BACKEND[w]) found.push(w)
      }
      return found
    }

    var isCollectorTermCompatibleBackend = function (targetQ, collTerm) {
      if (!targetQ || !collTerm) return false
      if (isDirtyTermInline(collTerm)) return false

      var normT = removeAccentsInline(softenSearchTermInline(targetQ) || targetQ)
        .toLowerCase()
        .trim()
      var normC = removeAccentsInline(softenSearchTermInline(collTerm) || collTerm)
        .toLowerCase()
        .trim()
      if (!normT || !normC) return false
      if (normT === normC) return true

      // Checar componentes de hardware incompatíveis
      var targetComps = extractCompTokensBackend(normT)
      var collComps = extractCompTokensBackend(normC)
      if (targetComps.length > 0 || collComps.length > 0) {
        for (var ci = 0; ci < collComps.length; ci++) {
          if (targetComps.indexOf(collComps[ci]) === -1) return false
        }
        for (var ti = 0; ti < targetComps.length; ti++) {
          if (collComps.indexOf(targetComps[ti]) === -1) return false
        }
      }

      if (normT.indexOf(normC) !== -1 || normC.indexOf(normT) !== -1) {
        return true
      }

      var tWords = normT.split(/\s+/).filter(function (w) {
        return w.length >= 3 && !genericCategoryWords[w]
      })
      var cWords = normC.split(/\s+/).filter(function (w) {
        return w.length >= 3 && !genericCategoryWords[w]
      })
      if (tWords.length === 0 || cWords.length === 0) return false

      var collSub = cWords.every(function (cw) {
        return tWords.some(function (tw) {
          return tw === cw || tw.indexOf(cw) !== -1 || cw.indexOf(tw) !== -1
        })
      })
      var targetSub = tWords.every(function (tw) {
        return cWords.some(function (cw) {
          return cw === tw || cw.indexOf(tw) !== -1 || tw.indexOf(cw) !== -1
        })
      })

      return collSub || targetSub
    }

    // Busca multi-candidato: termo normalizado, termo suavizado e tokens
    var candidateTerms = []
    var addCandidate = function (cand) {
      var c = (cand || '').trim()
      if (c && candidateTerms.indexOf(c) === -1) {
        candidateTerms.push(c)
      }
    }

    addCandidate(term)
    if (softened && softened !== term) {
      addCandidate(softened)
    }

    var records = []
    for (var ct = 0; ct < candidateTerms.length; ct++) {
      var cand = candidateTerms[ct]
      // 1. Tentar busca exata no search_term
      try {
        var exactRecs = $app.findRecordsByFilter(
          'ml_collector_imports',
          "search_term = '" + cand.replace(/'/g, "\\'") + "'",
          '-imported_at',
          15,
          0,
        )
        if (exactRecs && exactRecs.length > 0) {
          var validExact = []
          for (var eIdx = 0; eIdx < exactRecs.length; eIdx++) {
            var er = exactRecs[eIdx]
            var st = er.getString('search_term')
            if (!isDirtyTermInline(st) && isCollectorTermCompatibleBackend(term, st)) {
              validExact.push(er)
            }
          }
          if (validExact.length > 0) {
            records = validExact
            break
          }
        }
      } catch (_) {}

      // 2. Tentar busca por contém (LIKE / ~)
      try {
        var likeRecs = $app.findRecordsByFilter(
          'ml_collector_imports',
          "search_term ~ '" + cand.replace(/'/g, "\\'") + "'",
          '-imported_at',
          15,
          0,
        )
        if (likeRecs && likeRecs.length > 0) {
          var validLike = []
          for (var lIdx = 0; lIdx < likeRecs.length; lIdx++) {
            var lr = likeRecs[lIdx]
            var lst = lr.getString('search_term')
            if (!isDirtyTermInline(lst) && isCollectorTermCompatibleBackend(term, lst)) {
              validLike.push(lr)
            }
          }
          if (validLike.length > 0) {
            records = validLike
            break
          }
        }
      } catch (_) {}
    }

    // 3. Se ainda não encontrou, tentar por tokens significativos (ex.: "notebook lenovo t480" -> tokens "lenovo", "t480")
    if (records.length === 0) {
      var tokensSource = softened || term
      var tokens = tokensSource.split(/\s+/).filter(function (t) {
        return t.length >= 3 && !genericCategoryWords[t]
      })
      if (tokens.length > 0) {
        var andFilter = tokens
          .map(function (t) {
            return "search_term ~ '" + t.replace(/'/g, "\\'") + "'"
          })
          .join(' && ')
        try {
          var tokenRecs = $app.findRecordsByFilter(
            'ml_collector_imports',
            andFilter,
            '-imported_at',
            15,
            0,
          )
          if (tokenRecs && tokenRecs.length > 0) {
            var validTokens = []
            for (var tkIdx = 0; tkIdx < tokenRecs.length; tkIdx++) {
              var tr = tokenRecs[tkIdx]
              var tst = tr.getString('search_term')
              if (!isDirtyTermInline(tst) && isCollectorTermCompatibleBackend(term, tst)) {
                validTokens.push(tr)
              }
            }
            if (validTokens.length > 0) {
              records = validTokens
            }
          }
        } catch (_) {}
      }
    }

    // Buscar overrides cadastrados para o termo
    var overridesMap = {}
    try {
      var overrideRecs = $app.findRecordsByFilter(
        'ml_position_overrides',
        "search_term = '" + term.replace(/'/g, "\\'") + "'",
        '-created',
        500,
        0,
      )
      for (var ov = 0; ov < overrideRecs.length; ov++) {
        var oRec = overrideRecs[ov]
        var oItemId = oRec.getString('ml_item_id')
        var oAct = oRec.getString('action')
        if (oItemId && oAct && !overridesMap[oItemId]) {
          overridesMap[oItemId] = oAct
        }
      }
    } catch (_) {}

    // Lista de termos fora do contexto de informática (miniaturas, bicicletas, brinquedos)
    var NOISE_TERMS = [
      'miniatura',
      'miniaturas',
      'mini bike',
      'bicicleta',
      'bicicletinha',
      'bike',
      'hot wheels',
      'hotwheels',
      'carrinho',
      'carrinhos',
      'boneco',
      'bonecos',
      'boneca',
      'bonecas',
      'brinquedo',
      'brinquedos',
      'infantil',
      'escala 1',
      '1:18',
      '1:24',
      '1:32',
      '1:43',
      '1:64',
      'diecast',
      'maisto',
      'burago',
      'bburago',
      'action figure',
      'pelucia',
      'vestido',
      'saia',
      'blusa',
      'perfume',
      'maquiagem',
      'batom',
      'esmalte',
      'shampoo',
      'condicionador',
      'sabonete',
      'brinco',
      'colar',
      'anel',
      'bebe',
      'maternidade',
      'chupeta',
      'mamadeira',
      'fralda',
    ]

    var checkIsNoise = function (t) {
      var lower = (t || '').toString().toLowerCase()
      for (var nt = 0; nt < NOISE_TERMS.length; nt++) {
        var word = NOISE_TERMS[nt]
        if (term.indexOf(word) === -1 && lower.indexOf(word) !== -1) {
          return true
        }
      }
      return false
    }

    var deduplicatedAds = {}
    var importsList = []

    for (var r = 0; r < records.length; r++) {
      var rec = records[r]
      var rawPayload = rec.get('payload')
      var parsed = null
      if (typeof rawPayload === 'string') {
        try {
          parsed = JSON.parse(rawPayload)
        } catch (_) {}
      } else if (Array.isArray(rawPayload)) {
        var str = bytesToStrInline(rawPayload)
        try {
          parsed = JSON.parse(str)
        } catch (_) {}
      } else if (rawPayload && typeof rawPayload === 'object') {
        parsed = rawPayload
      }

      var items = parsed && parsed.results ? parsed.results : Array.isArray(parsed) ? parsed : []
      importsList.push({
        id: rec.id,
        created: rec.getString('created') || rec.get('created'),
        source_url: rec.getString('source_url'),
        results_count: items.length,
        with_sales_count: rec.getInt('with_sales_count') || 0,
      })

      for (var i = 0; i < items.length; i++) {
        var it = items[i]
        var adId = (it.mlb_id || it.id || 'ITEM_' + i).toString().trim()
        var soldQty = it.sold_quantity != null ? Number(it.sold_quantity) : null
        var price = it.price != null ? Number(it.price) : null
        var title = (it.title || '').toString().trim()
        var seller = (it.seller_name || it.seller || '').toString().trim()
        var permalink = (it.permalink || '').toString().trim()
        var thumbnail = (it.thumbnail || '').toString().trim()
        var isFreeShipping = Boolean(it.is_free_shipping)
        var isFull = Boolean(it.is_full)
        var condition = (it.condition || '').toString().trim()

        if (!deduplicatedAds[adId]) {
          deduplicatedAds[adId] = {
            id: adId,
            mlb_id: it.mlb_id || adId,
            title: title,
            price: price,
            sold_quantity: soldQty,
            seller_name: seller,
            permalink: permalink,
            thumbnail: thumbnail,
            is_free_shipping: isFreeShipping,
            is_full: isFull,
            condition: condition,
          }
        } else {
          var exist = deduplicatedAds[adId]
          if (soldQty != null && (exist.sold_quantity == null || soldQty > exist.sold_quantity)) {
            exist.sold_quantity = soldQty
          }
          if (!exist.price && price) exist.price = price
          if (!exist.seller_name && seller) exist.seller_name = seller
          if (!exist.permalink && permalink) exist.permalink = permalink
          if (!exist.title && title) exist.title = title
          if (!exist.thumbnail && thumbnail) exist.thumbnail = thumbnail
        }
      }
    }

    var allAdsKeys = Object.keys(deduplicatedAds)
    var rawAllAds = []
    var allAds = []
    var noiseAds = []
    var manuallyExcludedCount = 0
    var manuallyIncludedCount = 0

    for (var k = 0; k < allAdsKeys.length; k++) {
      var candidate = deduplicatedAds[allAdsKeys[k]]
      rawAllAds.push(candidate)

      var cId = candidate.id || candidate.mlb_id
      var ovAction = overridesMap[cId]

      if (ovAction === 'exclude') {
        manuallyExcludedCount++
        noiseAds.push(candidate)
        continue
      }
      if (ovAction === 'include') {
        manuallyIncludedCount++
        allAds.push(candidate)
        continue
      }

      if (checkIsNoise(candidate.title)) {
        noiseAds.push(candidate)
        continue
      }

      allAds.push(candidate)
    }

    var adsWithSales = allAds.filter(function (a) {
      return a.sold_quantity != null && a.sold_quantity > 0
    })
    adsWithSales.sort(function (a, b) {
      return b.sold_quantity - a.sold_quantity
    })

    var totalSoldUnits = 0
    var totalSalesRevenue = 0
    var pricesWithSales = []

    for (var m = 0; m < adsWithSales.length; m++) {
      var adItem = adsWithSales[m]
      totalSoldUnits += adItem.sold_quantity
      if (adItem.price && adItem.price > 0) {
        totalSalesRevenue += adItem.price * adItem.sold_quantity
        pricesWithSales.push(adItem.price)
      }
    }

    pricesWithSales.sort(function (a, b) {
      return a - b
    })
    var simpleAvgPrice =
      pricesWithSales.length > 0
        ? pricesWithSales.reduce(function (s, p) {
            return s + p
          }, 0) / pricesWithSales.length
        : 0
    var weightedAvgPrice = totalSoldUnits > 0 ? totalSalesRevenue / totalSoldUnits : 0
    var medianPrice =
      pricesWithSales.length > 0
        ? pricesWithSales.length % 2 === 0
          ? (pricesWithSales[pricesWithSales.length / 2 - 1] +
              pricesWithSales[pricesWithSales.length / 2]) /
            2
          : pricesWithSales[Math.floor(pricesWithSales.length / 2)]
        : 0

    var minPriceWithSales = pricesWithSales.length > 0 ? pricesWithSales[0] : 0
    var maxPriceWithSales =
      pricesWithSales.length > 0 ? pricesWithSales[pricesWithSales.length - 1] : 0

    var extractFineSpecInline = function (title) {
      var cleanTitle = (title || '').toString().trim()
      if (!cleanTitle) return 'Outros'

      var ddrMatch = cleanTitle.match(
        /\b(ddr\s*5|ddr\s*4|ddr\s*3\s*l|ddr\s*3|ddr\s*2|pc\s*5|pc\s*4|pc\s*3\s*l|pc\s*3|pc\s*2)\b/i,
      )
      var kitMatch = cleanTitle.match(/\b(\d+)\s*[xX*]\s*(\d+)\s*(?:gb|gigas?)\b/i)
      var capMatch = cleanTitle.match(/\b(\d+)\s*(?:gb|gigas?)\b/i)
      var mhzMatch = cleanTitle.match(
        /\b(667|800|1066|1333|1600|1866|2133|2400|2666|2933|3000|3200|3600|4800|5200|5600|6000)\s*(?:mhz)?\b/i,
      )

      var isNotebook = /\b(sodimm|so-dimm|notebook|laptop|para\s+notebook)\b/i.test(cleanTitle)
      var isDesktop = /\b(dimm|udimm|desktop|pc\s+desktop|para\s+pc)\b/i.test(cleanTitle)

      var formTag = ''
      if (isNotebook) formTag = ' SODIMM'
      else if (isDesktop) formTag = ' Desktop'

      if (ddrMatch || capMatch) {
        var ddr = ddrMatch ? ddrMatch[0].toUpperCase().replace(/\s+/g, '') : 'RAM'
        if (ddr === 'PC3L') ddr = 'DDR3L'
        else if (ddr === 'PC3') ddr = 'DDR3'
        else if (ddr === 'PC4') ddr = 'DDR4'
        else if (ddr === 'PC5') ddr = 'DDR5'
        else if (ddr === 'PC2') ddr = 'DDR2'

        var cap = ''
        if (kitMatch) {
          cap = kitMatch[1] + 'x' + kitMatch[2] + 'GB'
        } else if (capMatch) {
          cap = capMatch[1] + 'GB'
        }

        var freq = ''
        if (mhzMatch) {
          freq = mhzMatch[1] + 'MHz'
        } else {
          freq = '(freq. n/d)'
        }

        return (ddr + ' ' + cap + ' ' + freq + formTag).replace(/\s+/g, ' ').trim()
      }

      var cpuIntelMatch = cleanTitle.match(/\b(core\s+)?(i[3579])[- ]?(\d{3,5}[a-z]{0,2})\b/i)
      if (cpuIntelMatch) {
        return 'Intel ' + cpuIntelMatch[2].toUpperCase() + '-' + cpuIntelMatch[3].toUpperCase()
      }
      var cpuAmdMatch = cleanTitle.match(/\b(ryzen\s+[3579])\s*(\d{4}[a-z]{0,2})\b/i)
      if (cpuAmdMatch) {
        return 'AMD ' + cpuAmdMatch[1].toUpperCase() + ' ' + cpuAmdMatch[2].toUpperCase()
      }

      var storageMatch = cleanTitle.match(/\b(ssd|nvme|m\.2|hd|disco\s+rigido)\b/i)
      var storageCap = cleanTitle.match(/\b(\d+)\s*(?:gb|tb)\b/i)
      if (storageMatch && storageCap) {
        var type = storageMatch[1].toUpperCase().replace(/\./g, '')
        var scap = storageCap[0].toUpperCase().replace(/\s+/g, '')
        return type + ' ' + scap
      }

      var formMatch = cleanTitle.match(/\b(sff|tiny|mini|micro|usff|desktop|ultrabook)\b/i)
      if (formMatch) {
        return formMatch[1].toUpperCase()
      }

      return 'Outras Especificações'
    }

    // Agrupamento por especificação fina cobrindo TODOS os anúncios
    var specMap = {}
    for (var n = 0; n < allAds.length; n++) {
      var itm = allAds[n]
      var sKey = extractFineSpecInline(itm.title)

      if (!specMap[sKey]) {
        specMap[sKey] = {
          spec: sKey,
          totalUnits: 0,
          totalRevenue: 0,
          adCount: 0,
          adsWithSalesCount: 0,
          adsWithoutSalesCount: 0,
          pricesWithSales: [],
          ads: [],
        }
      }

      var sObj = specMap[sKey]
      sObj.adCount += 1
      sObj.ads.push(itm)

      var sq = itm.sold_quantity != null && itm.sold_quantity > 0 ? itm.sold_quantity : 0
      if (sq > 0) {
        sObj.adsWithSalesCount += 1
        sObj.totalUnits += sq
        if (itm.price && itm.price > 0) {
          sObj.totalRevenue += itm.price * sq
          sObj.pricesWithSales.push(itm.price)
        }
      } else {
        sObj.adsWithoutSalesCount += 1
      }
    }

    var specKeys = Object.keys(specMap)
    var allSpecsRanked = []
    for (var p = 0; p < specKeys.length; p++) {
      var sp = specMap[specKeys[p]]
      sp.pricesWithSales.sort(function (a, b) {
        return a - b
      })

      var cnt = sp.pricesWithSales.length
      var sAvg =
        cnt > 0
          ? sp.pricesWithSales.reduce(function (s, val) {
              return s + val
            }, 0) / cnt
          : 0
      var wAvg = sp.totalUnits > 0 ? sp.totalRevenue / sp.totalUnits : 0
      var med =
        cnt > 0
          ? cnt % 2 === 0
            ? (sp.pricesWithSales[cnt / 2 - 1] + sp.pricesWithSales[cnt / 2]) / 2
            : sp.pricesWithSales[Math.floor(cnt / 2)]
          : 0
      var sMin = cnt > 0 ? sp.pricesWithSales[0] : 0
      var sMax = cnt > 0 ? sp.pricesWithSales[cnt - 1] : 0
      var shareP = totalSoldUnits > 0 ? Math.round((sp.totalUnits / totalSoldUnits) * 1000) / 10 : 0

      var sAdsWithSales = sp.ads.filter(function (a) {
        return a.sold_quantity != null && a.sold_quantity > 0
      })
      sAdsWithSales.sort(function (a, b) {
        return (b.sold_quantity || 0) - (a.sold_quantity || 0)
      })
      var chAd = sAdsWithSales.length > 0 ? sAdsWithSales[0] : sp.ads.length > 0 ? sp.ads[0] : null

      allSpecsRanked.push({
        spec: sp.spec,
        totalUnits: sp.totalUnits,
        totalRevenue: Math.round(sp.totalRevenue * 100) / 100,
        adCount: sp.adCount,
        adsWithSalesCount: sp.adsWithSalesCount,
        adsWithoutSalesCount: sp.adsWithoutSalesCount,
        weightedAvgPrice: Math.round(wAvg * 100) / 100,
        simpleAvgPrice: Math.round(sAvg * 100) / 100,
        medianPrice: Math.round(med * 100) / 100,
        minPrice: sMin,
        maxPrice: sMax,
        sharePercent: shareP,
        championAd: chAd,
        ads: sp.ads,
      })
    }

    allSpecsRanked.sort(function (a, b) {
      if (b.totalUnits !== a.totalUnits) return b.totalUnits - a.totalUnits
      return b.adCount - a.adCount
    })

    return e.json(200, {
      ok: true,
      term: term,
      imports_count: records.length,
      imports: importsList,
      total_deduplicated_ads: allAds.length,
      ads_with_sales_count: adsWithSales.length,
      total_sold_units: totalSoldUnits,
      weighted_avg_price: Math.round(weightedAvgPrice * 100) / 100,
      simple_avg_price: Math.round(simpleAvgPrice * 100) / 100,
      median_price: Math.round(medianPrice * 100) / 100,
      min_price: minPriceWithSales,
      max_price: maxPriceWithSales,
      champion_ad: adsWithSales.length > 0 ? adsWithSales[0] : null,
      top_ads: adsWithSales.slice(0, 10),
      top_specs: allSpecsRanked.slice(0, 8),
      all_specs: allSpecsRanked,
      all_deduplicated_ads: allAds,
      noise_ads_count: noiseAds.length,
      noise_ads: noiseAds,
      manually_excluded_count: manuallyExcludedCount,
      manually_included_count: manuallyIncludedCount,
      raw_total_ads_count: rawAllAds.length,
    })
  } catch (err) {
    return e.json(500, { ok: false, error: 'Erro ao gerar resumo: ' + (err.message || err) })
  }
})
