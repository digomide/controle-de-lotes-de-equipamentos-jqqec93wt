migrate(
  (app) => {
    // 0100_inspect_nordic_content.js
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

    const m = raw.match(/<script\s+id=["']__NORDIC_RENDERING_CTX__["'][^>]*>([\s\S]*?)<\/script>/i)
    let sample = ''
    if (m) {
      // Mostrar primeiros 500 chars
      sample = m[1].substring(0, 800)
    }

    job.set('error_message', sample)
    app.save(job)
  },
  (app) => {},
)
