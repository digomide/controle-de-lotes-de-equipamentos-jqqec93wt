migrate(
  (app) => {
    let token = ''
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (sRecords && sRecords.length > 0) {
      token = sRecords[0].getString('access_token')
    }

    const testUrl =
      'https://www.mercadolivre.com.br/notebook-dell-latitude-5420-i5-11-ger-8gb-ssd-256gb-w11-pro-cinza-excelente-recondicionado/p/MLB2097858038'
    const r = $http.send({
      url: testUrl,
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
      timeout: 10,
    })

    const body = r.raw || ''
    // Procurar blocos JSON no HTML (como __PRELOADED_STATE__ ou ld+json)
    let jsonSnippets = []
    const ldJsonMatches =
      body.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi) || []
    for (let i = 0; i < ldJsonMatches.length; i++) {
      const content = ldJsonMatches[i].replace(/<script[^>]*>/, '').replace(/<\/script>/, '')
      if (content.includes('sold') || content.includes('venda') || content.includes('offer')) {
        jsonSnippets.push(content.substring(0, 150))
      }
    }

    // Procurar por window.__PRELOADED_STATE__
    let preloadedSold = ''
    const stateMatch = body.match(/__PRELOADED_STATE__\s*=\s*(\{[\s\S]*?\});/i)
    if (stateMatch) {
      const stateStr = stateMatch[1]
      const soldIdx = stateStr.indexOf('sold_quantity')
      if (soldIdx !== -1) {
        preloadedSold = stateStr.substring(
          Math.max(0, soldIdx - 30),
          Math.min(stateStr.length, soldIdx + 50),
        )
      }
    }

    // Procurar na listagem de busca: https://lista.mercadolivre.com.br/dell-latitude-5420
    const listUrl = 'https://lista.mercadolivre.com.br/dell-latitude-5420'
    const rList = $http.send({
      url: listUrl,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 8,
    })
    const listBody = rList.raw || ''
    const listIdx2097 = listBody.indexOf('MLB2097858038')
    let listSnippet = ''
    if (listIdx2097 !== -1) {
      listSnippet = listBody.substring(
        Math.max(0, listIdx2097 - 200),
        Math.min(listBody.length, listIdx2097 + 500),
      )
    }

    const testJob = app.findRecordById('ml_competitor_jobs', 'wp8elpqepb1vao9')
    testJob.set(
      'seller_nickname',
      ('preloaded=' + preloadedSold + ' | listSnippet=' + listSnippet.substring(0, 100)).substring(
        0,
        240,
      ),
    )
    testJob.set(
      'error_message',
      JSON.stringify({
        preloadedSold: preloadedSold,
        listSnippet: listSnippet,
        ldJson: jsonSnippets,
      }).substring(0, 3000),
    )
    app.save(testJob)
  },
  (app) => {},
)
