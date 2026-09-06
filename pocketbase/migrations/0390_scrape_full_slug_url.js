migrate(
  (app) => {
    const testUrl =
      'https://www.mercadolivre.com.br/notebook-dell-latitude-5420-i5-11-ger-8gb-ssd-256gb-w11-pro-cinza-excelente-recondicionado/p/MLB2097858038'
    let textResult = ''
    try {
      const r = $http.send({
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
      textResult = 'status=' + r.statusCode + ' len=' + (r.raw ? r.raw.length : 0)
      if (r.raw) {
        // Procurar por padrão de vendidos (ex: +1 mil vendidos, 100 vendidos, etc.)
        const matches = r.raw.match(/(\+?[0-9.]+\s*mil\s*vendidos|\+?[0-9.]+\s*vendidos)/gi)
        if (matches) {
          textResult += ' | MATCHES: ' + matches.join(' ; ')
        } else {
          // Procurar qualquer ocorrência de 'vendid'
          const idx = r.raw.toLowerCase().indexOf('vendid')
          if (idx !== -1) {
            textResult +=
              ' | SNIPPET: ' +
              r.raw
                .substring(Math.max(0, idx - 60), Math.min(r.raw.length, idx + 60))
                .replace(/\s+/g, ' ')
          } else {
            textResult += ' | NO_VENDID'
          }
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
