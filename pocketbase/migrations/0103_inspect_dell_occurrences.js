migrate(
  (app) => {
    // 0103_inspect_dell_occurrences.js
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

    const snippets = []
    let idx = 0
    while ((idx = raw.toLowerCase().indexOf('dell', idx)) !== -1 && snippets.length < 5) {
      snippets.push(raw.substring(Math.max(0, idx - 50), Math.min(raw.length, idx + 150)))
      idx += 4
    }

    job.set('error_message', JSON.stringify(snippets).substring(0, 1500))
    app.save(job)
  },
  (app) => {},
)
