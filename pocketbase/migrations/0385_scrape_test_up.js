migrate(
  (app) => {
    let token = ''
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (sRecords && sRecords.length > 0) {
      token = sRecords[0].getString('access_token')
    }

    const testUrl = 'https://www.mercadolivre.com.br/dell-latitude-5420/up/MLBU3748462806'
    let textResult = ''
    try {
      const r = $http.send({
        url: testUrl,
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        },
        timeout: 8,
      })
      textResult = 'status=' + r.statusCode + ' len=' + (r.raw ? r.raw.length : 0)
      if (r.raw) {
        const m = r.raw.match(/([0-9.]+\s*mil\s*vendidos|[0-9.]+\s*vendidos)/gi)
        if (m) {
          textResult += ' | matches=' + m.join(' ; ')
        } else {
          textResult += ' | no_vendidos_match'
        }
      }
    } catch (e) {
      textResult = 'err=' + String(e)
    }

    const job = app.findRecordById('ml_competitor_jobs', 'wp8elpqepb1vao9')
    job.set('seller_nickname', textResult.substring(0, 250))
    app.save(job)
  },
  (app) => {},
)
