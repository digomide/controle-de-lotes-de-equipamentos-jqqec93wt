migrate(
  (app) => {
    // 0108_inspect_more_subendpoints.js
    // Testar /products/{id} com MLB2010941196:
    // o que veio no buy_box_winner? O que veio no children_ids?
    let accessToken = ''
    try {
      const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
      if (sRecords && sRecords.length > 0) {
        accessToken = (sRecords[0].getString('access_token') || '').trim()
      }
    } catch (_) {}

    const res = $http.send({
      url: 'https://api.mercadolibre.com/products/MLB2010941196',
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer ' + accessToken,
      },
      timeout: 10,
    })
    const data = res.json || {}

    // Testar endpoint /items/MLB4836138319 com User-Agent real
    const iRes = $http.send({
      url: 'https://api.mercadolibre.com/items/MLB4836138319',
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      timeout: 10,
    })

    // Testar https://produto.mercadolivre.com.br/MLB-4836138319
    const pRes = $http.send({
      url: 'https://produto.mercadolivre.com.br/MLB-4836138319',
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      timeout: 10,
    })

    // Testar se https://produto.mercadolivre.com.br/MLB-4709060403 tem og:title ou preço
    const pRes2 = $http.send({
      url: 'https://produto.mercadolivre.com.br/MLB-4709060403',
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      timeout: 10,
    })

    const rec = app.findFirstRecordByData('ml_competitors', 'seller_id', 'diag_test')
    const summary = {
      prodName: data.name,
      prodStatus: data.status,
      buy_box_winner: data.buy_box_winner,
      price: data.price,
      pic: data.pictures && data.pictures[0] ? data.pictures[0].url : '',
      item4836_status: iRes.statusCode,
      pRes_status: pRes.statusCode,
      pRes_hasMlb: (pRes.raw || '').includes('MLB'),
      pRes2_status: pRes2.statusCode,
      pRes2_len: (pRes2.raw || '').length,
    }
    rec.set('notes', JSON.stringify(summary).substring(0, 500))
    app.save(rec)
  },
  (app) => {},
)
