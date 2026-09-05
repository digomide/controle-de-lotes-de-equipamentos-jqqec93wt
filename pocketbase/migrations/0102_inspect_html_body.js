migrate(
  (app) => {
    // 0102_inspect_html_body.js
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

    // Procurar Dell, Latitude, 3420, 1135g7, 4836138319, 2010941196
    const has2010 = raw.includes('2010941196')
    const has4836 = raw.includes('4836138319')
    const hasDell = raw.toLowerCase().includes('dell')
    const hasPriceSymbol = raw.includes('R$')

    // Encontrar índices onde aparece R$ ou 4836138319
    const snippets = []
    let idx = 0
    while ((idx = raw.indexOf('R$', idx)) !== -1 && snippets.length < 5) {
      snippets.push(raw.substring(Math.max(0, idx - 40), Math.min(raw.length, idx + 80)))
      idx += 2
    }

    const mlbSnippets = []
    let idxMlb = 0
    while ((idxMlb = raw.indexOf('MLB', idxMlb)) !== -1 && mlbSnippets.length < 5) {
      mlbSnippets.push(raw.substring(Math.max(0, idxMlb - 20), Math.min(raw.length, idxMlb + 50)))
      idxMlb += 3
    }

    const diag = {
      rawLen: raw.length,
      has2010,
      has4836,
      hasDell,
      hasPriceSymbol,
      snippets,
      mlbSnippets,
    }

    job.set('error_message', JSON.stringify(diag).substring(0, 1500))
    app.save(job)
  },
  (app) => {},
)
