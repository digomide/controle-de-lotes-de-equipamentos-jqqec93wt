/**
 * Hook disparado imediatamente após a criação de um job de busca de catálogo.
 *
 * REGRA CRÍTICA DE DESACOPLAMENTO (ETAPA 1):
 * - Esta requisição HTTP DEVE responder em < 1s para o cliente.
 * - NENHUM varrimento de ML síncrono pode acontecer aqui dentro.
 * - Se houver cache fresco (<15min) de busca idêntica, entrega de imediato.
 * - Caso contrário, marca o job como 'pending' e retorna imediatamente.
 * - O processamento em segundo plano é executado de forma cooperativa pelo
 *   worker agendado em `ml_queue_worker.js`.
 */

onRecordAfterCreateSuccess((e) => {
  const rec = e.record
  const appId = $app

  const queryRaw = (rec.getString('query') || '').trim()
  const categoryId = (rec.getString('category_id') || '').trim()

  // Condição direcionada da busca ('all' | 'refurbished' | 'new' | 'used' | 'open_box')
  const requestedConditionRaw = (rec.getString('condition') || '').trim().toLowerCase()
  const requestedCondition =
    requestedConditionRaw === 'refurbished' ||
    requestedConditionRaw === 'new' ||
    requestedConditionRaw === 'used' ||
    requestedConditionRaw === 'open_box'
      ? requestedConditionRaw
      : 'all'

  const forceRefresh = rec.getBool
    ? rec.getBool('force_refresh')
    : Boolean(rec.get('force_refresh'))

  // =========================================================================
  // CHECAGEM RÁPIDA DE CACHE (TTL 15 MINUTOS)
  // Se houver busca recente concluída com sucesso para o mesmo termo/condição/categoria,
  // entrega imediatamente sem esperar o cron worker.
  // =========================================================================
  if (!forceRefresh && queryRaw) {
    try {
      const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000)
      const dateStr = fifteenMinAgo.toISOString().replace('T', ' ').substring(0, 19)

      const safeQuery = queryRaw.replace(/'/g, "\\'")
      const safeCond = requestedCondition.replace(/'/g, "\\'")
      const safeCat = categoryId.replace(/'/g, "\\'")
      let cacheFilter = `status = 'done' && query = '${safeQuery}' && condition = '${safeCond}' && created >= '${dateStr}' && id != '${rec.id}'`
      if (safeCat) {
        cacheFilter += ` && category_id = '${safeCat}'`
      }

      const cachedJobs = appId.findRecordsByFilter(
        'ml_catalog_search_jobs',
        cacheFilter,
        '-created',
        1,
        0,
      )

      if (cachedJobs && cachedJobs.length > 0) {
        const cached = cachedJobs[0]
        let parsedResults = []

        // 1. Tentar carregar a partir dos chunks se o job foi particionado
        const hasChunks = cached.getBool
          ? cached.getBool('has_chunks')
          : Boolean(cached.get('has_chunks'))
        if (hasChunks) {
          try {
            const chunkRecs = appId.findRecordsByFilter(
              'ml_catalog_search_results',
              `job_id = '${cached.id}'`,
              'chunk_index',
              50,
              0,
            )
            if (chunkRecs && chunkRecs.length > 0) {
              for (let ci = 0; ci < chunkRecs.length; ci++) {
                const cPayload = chunkRecs[ci].get('payload_json')
                if (Array.isArray(cPayload)) {
                  parsedResults = parsedResults.concat(cPayload)
                } else if (typeof cPayload === 'string') {
                  try {
                    const parsedP = JSON.parse(cPayload)
                    if (Array.isArray(parsedP)) parsedResults = parsedResults.concat(parsedP)
                  } catch (_) {}
                }
              }

              // Duplicar chunks para o novo registro para que ele também responda via chunks
              try {
                const resultsCol = appId.findCollectionByNameOrId('ml_catalog_search_results')
                if (resultsCol) {
                  for (let ci = 0; ci < chunkRecs.length; ci++) {
                    const originalIdx = chunkRecs[ci].getInt
                      ? chunkRecs[ci].getInt('chunk_index')
                      : Number(chunkRecs[ci].get('chunk_index')) || ci + 1
                    const safeChunkIdx = originalIdx > 0 ? originalIdx : ci + 1
                    const newChunk = new Record(resultsCol)
                    newChunk.set('job_id', rec.id)
                    newChunk.set('chunk_index', safeChunkIdx)
                    newChunk.set(
                      'items_count',
                      chunkRecs[ci].getInt ? chunkRecs[ci].getInt('items_count') : 0,
                    )
                    newChunk.set('payload_json', chunkRecs[ci].get('payload_json'))
                    appId.save(newChunk)
                  }
                  rec.set('has_chunks', true)
                  rec.set('chunk_count', chunkRecs.length)
                }
              } catch (_) {}
            }
          } catch (eChunks) {
            console.warn('[ml_catalog_search_queue] Falha ao carregar chunks do cache:', eChunks)
          }
        }

        // 2. Fallback para campo results clássico se chunks não trouxeram dados
        if (parsedResults.length === 0) {
          const cachedResults = cached.get('results')
          if (Array.isArray(cachedResults)) {
            parsedResults = cachedResults
          } else if (typeof cachedResults === 'string' && cachedResults.length > 2) {
            try {
              parsedResults = JSON.parse(cachedResults)
            } catch (_) {}
          }
        }

        if (parsedResults && parsedResults.length > 0) {
          rec.set('status', 'done')
          rec.set('status_code', 200)
          rec.set('strategy_used', (cached.getString('strategy_used') || 'cached') + '_cached')
          // No record principal: persistir só metadados e amostra dos 3 primeiros itens (sem megabytes)
          rec.set('results', parsedResults.slice(0, 3))
          rec.set('results_count', parsedResults.length)
          rec.set('is_cached', true)
          const cachedCreated = cached.getString('created') || new Date().toISOString()
          rec.set('cached_at', cachedCreated)
          const cachedPaging = cached.get('paging')
          if (cachedPaging) rec.set('paging', cachedPaging)
          rec.set(
            'progress_text',
            `Resultados obtidos em cache (${parsedResults.length} posições de ${cachedCreated.substring(11, 16)}). Pronto para uso imediato!`,
          )
          appId.save(rec)
          return
        }
      }
    } catch (errCache) {
      console.warn('[ml_catalog_search_queue] Aviso ao checar cache rápido:', errCache)
    }
  }

  // DESACOPLAMENTO IMEDIATO:
  // Se não veio do cache, define 'pending' e retorna imediatamente (<1s).
  // O processamento pesado de busca, concorrência e paginação fica a cargo do ml_queue_worker.js.
  rec.set('status', 'pending')
  rec.set('progress_text', 'Na fila... Aguardando início do processamento em segundo plano.')
  appId.save(rec)
}, 'ml_catalog_search_jobs')
