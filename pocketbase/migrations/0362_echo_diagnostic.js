migrate(
  (app) => {
    let token = ''
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (sRecords && sRecords.length > 0) {
      token = sRecords[0].getString('access_token')
    }

    const winnerItemId = 'MLB4510809603'
    const authHeaders = { Authorization: 'Bearer ' + token, Accept: 'application/json' }

    let details = {}

    // 1. Scraping ou GET na página /MLB4510809603
    try {
      const pRes = $http.send({
        url: 'https://produto.mercadolivre.com.br/MLB-4510809603',
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
        },
        timeout: 10,
      })
      const html = pRes.raw || ''
      // Procurar estoque
      const stockMatch =
        html.match(/(\d+)\s*(?:unidade|unidades)\s*(?:dispon[íi]ve|em estoque)/i) ||
        html.match(/"available_quantity":\s*(\d+)/i) ||
        html.match(/"initial_quantity":\s*(\d+)/i)
      // Procurar nome vendedor
      const sellerMatch =
        html.match(/class=["'][^"']*seller-name[^"']*["']>([^<]+)</i) ||
        html.match(/"seller_name":\s*"([^"]+)"/i) ||
        html.match(/ui-pdp-seller__link-trigger[^>]*>([^<]+)</i)
      details.html_stock = stockMatch ? stockMatch[0] : 'not_found'
      details.html_seller = sellerMatch ? sellerMatch[1] : 'not_found'
    } catch (e) {
      details.html_err = String(e)
    }

    // 2. Vendedor 3003560649
    try {
      const uRes = $http.send({
        url: 'https://api.mercadolibre.com/users/3003560649',
        method: 'GET',
        headers: authHeaders,
        timeout: 5,
      })
      details.user_api = uRes.json
    } catch (e2) {
      details.user_err = String(e2)
    }

    // 3. GET /products/MLB18732668/items
    try {
      const p18 = $http.send({
        url: 'https://api.mercadolibre.com/products/MLB18732668/items',
        method: 'GET',
        headers: authHeaders,
        timeout: 5,
      })
      details.p18_items = p18.statusCode === 200 && p18.json ? p18.json.results : p18.statusCode
    } catch (e3) {
      details.p18_err = String(e3)
    }

    throw new Error('ECHO_WINNER_STOCK: ' + JSON.stringify(details))
  },
  (app) => {},
)
