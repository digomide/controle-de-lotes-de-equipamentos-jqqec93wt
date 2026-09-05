migrate(
  (app) => {
    // 0101_inspect_price_and_seller_in_nordic.js
    const job = app.findFirstRecordByData(
      'ml_competitor_jobs',
      'query',
      'probe_mlb_sources_2010941196',
    )

    const realUrl =
      'https://www.mercadolivre.com.br/dell-g7-15-i7-1135g7-16gb-256-m2-cor-preto-excelente-recondicionado/p/MLB2010941196'

    const pageRes = $http.send({
      url: realUrl,
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
      },
      timeout: 15,
    })

    const raw = pageRes.raw || ''

    // Procurar termos como "price", "seller", "title" dentro do script nordic
    const m = raw.match(/<script\s+id=["']__NORDIC_RENDERING_CTX__["'][^>]*>([\s\S]*?)<\/script>/i)
    const ctx = m ? m[1] : ''

    // Pesquisar por "seller_id", "sellerId", "seller_name", "price", "amount"
    const priceMatches = []
    const priceRe = /"(?:price|amount|price_amount)":\s*([0-9]+(?:\.[0-9]+)?)/gi
    let pMatch
    while ((pMatch = priceRe.exec(ctx)) !== null && priceMatches.length < 10) {
      priceMatches.push(pMatch[0])
    }

    const sellerMatches = []
    const sellerRe =
      /"(?:seller_id|sellerId|seller|user_id|seller_name|nickname)":\s*([0-9]+|"[^"]{1,50}")/gi
    let sMatch
    while ((sMatch = sellerRe.exec(ctx)) !== null && sellerMatches.length < 10) {
      sellerMatches.push(sMatch[0])
    }

    const titleMatches = []
    const titleRe = /"(?:title|name|item_title)":\s*"([^"]{10,120})"/gi
    let tMatch
    while ((tMatch = titleRe.exec(ctx)) !== null && titleMatches.length < 5) {
      titleMatches.push(tMatch[0])
    }

    const res = {
      ctxLen: ctx.length,
      priceMatches,
      sellerMatches,
      titleMatches,
    }

    job.set('error_message', JSON.stringify(res).substring(0, 1500))
    app.save(job)
  },
  (app) => {},
)
