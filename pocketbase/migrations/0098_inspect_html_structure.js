migrate(
  (app) => {
    // 0098_inspect_html_structure.js
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

    // Procurar título: <title>, <h1>, ui-pdp-title
    const titleMatch = raw.match(/<title>([^<]+)<\/title>/i)
    const h1Match = raw.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)

    // Procurar por classes de preço do ML:
    // andes-money-amount__fraction, ui-pdp-price__second-line, price-tag-fraction
    const fractionMatches = raw.match(
      /class=["'][^"']*andes-money-amount__fraction[^"']*["']>([^<]+)<\/span>/gi,
    )

    // Procurar por seller / vendido por
    // "Vendido por", "ui-pdp-seller__link-trigger", "seller"
    const soldByMatch =
      raw.match(/Vendido\s+por\s+<[^>]+>([^<]+)<\/[^>]+>/i) ||
      raw.match(/ui-pdp-seller__link-trigger[^>]*>([^<]+)</i) ||
      raw.match(/class=["'][^"']*seller-name[^"']*["']>([^<]+)</i)

    // Procurar por scripts contendo JSON com dados do anúncio
    // Procurar <script> tags
    const scripts = raw.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || []
    let scriptWithPrice = 0
    let scriptPreview = ''
    for (let s = 0; s < scripts.length; s++) {
      const content = scripts[s]
      if (
        content.includes('MLB2010941196') ||
        content.includes('MLB4836138319') ||
        content.includes('andes-money-amount')
      ) {
        scriptWithPrice++
        if (!scriptPreview) scriptPreview = content.substring(0, 300)
      }
    }

    const diag = {
      rawLen: raw.length,
      pageTitle: titleMatch ? titleMatch[1] : null,
      h1: h1Match ? h1Match[1].replace(/<[^>]+>/g, '').trim() : null,
      fractions: fractionMatches ? fractionMatches.slice(0, 5) : [],
      soldBy: soldByMatch ? soldByMatch[1] : null,
      scriptsFound: scripts.length,
      scriptWithPrice,
      scriptPreview,
    }

    job.set('error_message', JSON.stringify(diag))
    app.save(job)
  },
  (app) => {},
)
