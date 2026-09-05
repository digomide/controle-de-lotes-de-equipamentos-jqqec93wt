migrate(
  (app) => {
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    const token = sRecords[0].getString('access_token')

    // 1. Busca ampla por notebook para ver produtos com buy_box_winner ativo
    const res = $http.send({
      url: 'https://api.mercadolibre.com/products/search?status=active&site_id=MLB&domain_id=MLB-NOTEBOOKS&q=notebook&limit=50&offset=0',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 10,
    })

    let withBB = []
    let sampleProduct = null
    if (res.statusCode === 200 && res.json && res.json.results) {
      for (let i = 0; i < res.json.results.length; i++) {
        const p = res.json.results[i]
        if (p.buy_box_winner) {
          withBB.push({
            id: p.id,
            name: p.name,
            bb: p.buy_box_winner,
          })
        }
      }
      if (res.json.results.length > 0) {
        sampleProduct = res.json.results[0]
      }
    }

    // 2. Se achou com BB, testar /products/{id}/items
    let bbItems = null
    if (withBB.length > 0) {
      try {
        const iRes = $http.send({
          url: 'https://api.mercadolibre.com/products/' + withBB[0].id + '/items',
          method: 'GET',
          headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
          timeout: 10,
        })
        bbItems = {
          statusCode: iRes.statusCode,
          json: iRes.json,
        }
      } catch (e) {
        bbItems = { error: String(e) }
      }
    }

    // 3. Testar a página pública de um produto de catálogo (ex: MLB37239539 ou o primeiro encontrado)
    let pageScrape = null
    const targetId =
      withBB.length > 0 ? withBB[0].id : sampleProduct ? sampleProduct.id : 'MLB37239539'
    try {
      const pRes = $http.send({
        url: 'https://www.mercadolivre.com.br/p/' + targetId,
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9',
        },
        timeout: 12,
      })
      const html = pRes.raw || ''
      // Procurar menções de condição, estoque, vendedores, preloaded state
      pageScrape = {
        statusCode: pRes.statusCode,
        htmlLen: html.length,
        hasRecondicionado: html.toLowerCase().indexOf('recondicionado') >= 0,
        hasNovo: html.toLowerCase().indexOf('novo') >= 0,
        hasUsado: html.toLowerCase().indexOf('usado') >= 0,
        hasDisponiveis: html.toLowerCase().indexOf('disponív') >= 0,
        hasEstoque: html.toLowerCase().indexOf('estoque') >= 0,
        // procurar script preloaded state ou nordic
        hasPreloadedState: html.indexOf('__PRELOADED_STATE__') >= 0,
        hasNordic: html.indexOf('__NORDIC_RENDERING_CTX__') >= 0,
      }
    } catch (pe) {
      pageScrape = { error: String(pe) }
    }

    const job = app.findFirstRecordByData('ml_catalog_search_jobs', 'id', 'szg3o742i7qawmh')
    job.set(
      'error_message',
      JSON.stringify({
        countWithBB: withBB.length,
        firstBB: withBB[0] || null,
        bbItems: bbItems,
        targetId: targetId,
        pageScrape: pageScrape,
      }),
    )
    app.save(job)
  },
  (app) => {},
)
