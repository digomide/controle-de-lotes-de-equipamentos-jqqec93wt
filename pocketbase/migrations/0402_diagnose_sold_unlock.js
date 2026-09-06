migrate(
  (app) => {
    // Diagnosticar as 3 tentativas para destravar sold_quantity e registrar em log claramente
    const diag = {
      attempt_a_anon_search: null,
      attempt_b_public_page: null,
      attempt_c_internal_endpoints: null,
    }

    // 1. TENTATIVA (a): GET /sites/MLB/search SEM token (anônimo)
    try {
      const resA = $http.send({
        url: 'https://api.mercadolibre.com/sites/MLB/search?q=fonte+dell+3020&limit=5',
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
        timeout: 10,
      })
      const resultsA = resA.json && Array.isArray(resA.json.results) ? resA.json.results : []
      diag.attempt_a_anon_search = {
        statusCode: resA.statusCode,
        resultsCount: resultsA.length,
        firstItem: resultsA[0]
          ? {
              id: resultsA[0].id,
              title: resultsA[0].title,
              sold_quantity: resultsA[0].sold_quantity,
              available_quantity: resultsA[0].available_quantity,
              seller_id: resultsA[0].seller ? resultsA[0].seller.id : null,
              seller_nick: resultsA[0].seller ? resultsA[0].seller.nickname : null,
            }
          : null,
        error: resA.json && resA.json.message ? resA.json.message : null,
      }
    } catch (eA) {
      diag.attempt_a_anon_search = { error: String(eA) }
    }

    // 2. TENTATIVA (b): Leitura server-side da página pública de busca https://lista.mercadolivre.com.br/fonte-dell-3020
    try {
      const resB = $http.send({
        url: 'https://lista.mercadolivre.com.br/fonte-dell-3020',
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
        timeout: 12,
      })
      const htmlB = resB.raw || ''
      const soldMatches = htmlB.match(/(\+?[0-9.]+\s*mil\s*vendidos|\+?[0-9.]+\s*vendidos)/gi) || []
      const mlbMatches = htmlB.match(/MLB-?[0-9]{8,14}/gi) || []
      diag.attempt_b_public_page = {
        statusCode: resB.statusCode,
        htmlLength: htmlB.length,
        hasSuspiciousTraffic:
          htmlB.includes('suspicious-traffic') || htmlB.includes('account-verification'),
        soldCountMatches: soldMatches.slice(0, 10),
        mlbFoundCount: mlbMatches.length,
      }
    } catch (eB) {
      diag.attempt_b_public_page = { error: String(eB) }
    }

    // 3. TENTATIVA (c): Endpoint interno de polycard / sites / search interno
    try {
      const resC = $http.send({
        url: 'https://www.mercadolivre.com.br/jm/search?as_word=fonte+dell+3020',
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9',
        },
        timeout: 10,
      })
      const htmlC = resC.raw || ''
      const soldMatchesC =
        htmlC.match(/(\+?[0-9.]+\s*mil\s*vendidos|\+?[0-9.]+\s*vendidos)/gi) || []
      diag.attempt_c_internal_endpoints = {
        statusCode: resC.statusCode,
        htmlLength: htmlC.length,
        soldMatches: soldMatchesC.slice(0, 10),
      }
    } catch (eC) {
      diag.attempt_c_internal_endpoints = { error: String(eC) }
    }

    console.log('[DIAGNOSTIC_SOLD_QUANTITY_0402]: ' + JSON.stringify(diag))

    // Salvar no registro de teste de jobs para podermos ler facilmente
    try {
      const testJob = app.findRecordById('ml_competitor_jobs', 'wp8elpqepb1vao9')
      testJob.set('query', JSON.stringify(diag).substring(0, 2000))
      testJob.set(
        'error_message',
        JSON.stringify({
          a: diag.attempt_a_anon_search ? diag.attempt_a_anon_search.statusCode : null,
          b: diag.attempt_b_public_page ? diag.attempt_b_public_page.soldCountMatches : null,
          c: diag.attempt_c_internal_endpoints
            ? diag.attempt_c_internal_endpoints.soldMatches
            : null,
        }),
      )
      app.save(testJob)
    } catch (_) {}
  },
  (app) => {},
)
