migrate(
  (app) => {
    let token = ''
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (sRecords && sRecords.length > 0) {
      token = sRecords[0].getString('access_token')
    }

    const testUrl = 'https://lista.mercadolivre.com.br/dell-latitude-5420'
    const rList = $http.send({
      url: testUrl,
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
      timeout: 10,
    })
    const body = rList.raw || ''
    const idx2097 = body.indexOf('MLB2097858038')
    let windowText = 'not_found'
    if (idx2097 !== -1) {
      // Olhar 1000 caracteres antes e 1000 depois
      const slice = body.substring(Math.max(0, idx2097 - 800), Math.min(body.length, idx2097 + 800))
      const matches = slice.match(
        /([0-9.]+\s*mil\s*vendidos|\+[0-9.]+\s*mil\s*vendidos|\+[0-9.]+\s*vendidos|[0-9.]+\s*vendidos)/gi,
      )
      windowText = 'found idx=' + idx2097 + ' matches=' + (matches ? matches.join('; ') : 'none')
      const tagTexts = (slice.match(/>([^<]+)</g) || [])
        .map(function (t) {
          return t.replace(/[><]/g, '').trim()
        })
        .filter(Boolean)
      windowText += ' | tags=' + tagTexts.slice(0, 10).join(' , ')
    }

    const testJob = app.findRecordById('ml_competitor_jobs', 'wp8elpqepb1vao9')
    testJob.set('seller_nickname', windowText.substring(0, 240))
    app.save(testJob)
  },
  (app) => {},
)
