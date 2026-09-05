migrate(
  (app) => {
    // 1. Carregar token ML
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    const token = sRecords[0].getString('access_token')

    // 2. Scraping da busca pública por "dell latitude 5420 recondicionado"
    const searchUrl = 'https://lista.mercadolivre.com.br/dell-latitude-5420-recondicionado'
    const pageRes = $http.send({
      url: searchUrl,
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
      timeout: 15,
    })

    let foundPIds = []
    if (pageRes.statusCode === 200 && pageRes.raw) {
      const html = pageRes.raw
      const pRegex = /href=["'](https?:\/\/[^"']*mercadolivre\.com\.br\/p\/(MLB[0-9]+)[^"']*)["']/gi
      let match
      while ((match = pRegex.exec(html)) !== null) {
        foundPIds.push(match[2])
      }
    }

    // Deduplicate
    const uniquePIds = Array.from(new Set(foundPIds))

    // 3. Consultar /products/{id} para os 3 primeiros
    const sampleProds = []
    for (let i = 0; i < Math.min(3, uniquePIds.length); i++) {
      const pid = uniquePIds[i]
      try {
        const pr = $http.send({
          url: 'https://api.mercadolibre.com/products/' + pid,
          method: 'GET',
          headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
          timeout: 10,
        })
        if (pr.statusCode === 200 && pr.json) {
          sampleProds.push({
            id: pr.json.id,
            name: pr.json.name,
            refurb_info: Boolean(pr.json.refurbished_info),
            grading: (pr.json.attributes || []).find(
              (a) => (a.id || '').toUpperCase() === 'GRADING',
            ),
          })
        }
      } catch (_) {}
    }

    const col = app.findCollectionByNameOrId('ml_ads_fetch_jobs')
    const report = new Record(col)
    report.set('status', 'done')
    report.set('status_filter', '__SCRAPE_RECONDICIONADO__')
    report.set(
      'progress_text',
      'HTML status: ' +
        pageRes.statusCode +
        ' foundPIds: ' +
        uniquePIds.length +
        ' has2097: ' +
        uniquePIds.includes('MLB2097858038'),
    )
    report.set(
      'error_message',
      JSON.stringify({
        unique_p_ids: uniquePIds,
        sample: sampleProds,
      }),
    )
    app.save(report)
  },
  (app) => {},
)
