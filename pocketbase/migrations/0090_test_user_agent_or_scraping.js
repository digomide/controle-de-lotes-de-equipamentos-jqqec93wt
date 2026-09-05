migrate(
  (app) => {
    // 0090_test_user_agent_or_scraping.js
    // Testar se https://produto.mercadolivre.com.br/MLB-4709060403 ou api responde com user-agent diferente
    const col = app.findCollectionByNameOrId('ml_competitor_jobs')
    const job = app.findFirstRecordByData('ml_competitor_jobs', 'query', 'direct_token_test')

    let accessToken = ''
    try {
      const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
      if (sRecords && sRecords.length > 0) {
        accessToken = (sRecords[0].getString('access_token') || '').trim()
      }
    } catch (_) {}

    // Teste A: HTML direto da página do anúncio
    let pageStatus = 0
    let pageTitle = ''
    let pagePrice = ''
    let pageSeller = ''
    try {
      const pRes = $http.send({
        url: 'https://produto.mercadolivre.com.br/MLB-4709060403',
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        },
        timeout: 10,
      })
      pageStatus = pRes.statusCode
      const html = pRes.raw || ''
      // tentar achar title ou seller
      const tMatch = html.match(/<title>(.*?)<\/title>/i)
      if (tMatch) pageTitle = tMatch[1]
      const sMatch =
        html.match(/"seller_id":\s*([0-9]+)/i) ||
        html.match(/"sellerId":\s*([0-9]+)/i) ||
        html.match(/"seller":\s*{"id":\s*([0-9]+)/i)
      if (sMatch) pageSeller = sMatch[1]
      const pMatch = html.match(/"price":\s*([0-9]+(?:\.[0-9]+)?)/i)
      if (pMatch) pagePrice = pMatch[1]
    } catch (eP) {
      pageTitle = 'Err: ' + eP
    }

    // Teste B: items sem trailing slash vs com
    let apiStatusNoToken = 0
    try {
      const aRes = $http.send({
        url: 'https://api.mercadolibre.com/items/MLB4709060403',
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
        timeout: 10,
      })
      apiStatusNoToken = aRes.statusCode
    } catch (_) {}

    job.set(
      'error_message',
      JSON.stringify({
        pageStatus,
        pageTitle: pageTitle.substring(0, 100),
        pageSeller,
        pagePrice,
        apiStatusNoToken,
      }),
    )
    app.save(job)
  },
  (app) => {},
)
