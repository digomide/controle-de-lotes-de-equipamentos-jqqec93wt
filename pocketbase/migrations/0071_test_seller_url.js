migrate(
  (app) => {
    // 0071_test_seller_url.js
    const col = app.findCollectionByNameOrId('ml_competitor_jobs')
    const job = new Record(col)
    job.set('action', 'search_query')
    job.set('status', 'processing')

    // Testar URL oficial de listagem do vendedor:
    // https://www.mercadolivre.com.br/pagina/infoprecobaixo
    // e https://lista.mercadolivre.com.br/informatica/infoprecobaixo
    const resObj = {}
    try {
      const r1 = $http.send({
        url: 'https://lista.mercadolivre.com.br/infoprecobaixo',
        method: 'GET',
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 10,
      })
      resObj.r1 = {
        status: r1.statusCode,
        len: r1.raw ? r1.raw.length : 0,
        hasMLB: (r1.raw || '').includes('MLB'),
        hasItems:
          (r1.raw || '').includes('ui-search-item__title') ||
          (r1.raw || '').includes('poly-component__title'),
      }
      if (r1.raw) {
        const m = r1.raw.match(/MLB-?[0-9]+/gi) || []
        resObj.r1.matches = m.slice(0, 5)
      }
    } catch (e1) {
      resObj.r1 = { err: String(e1) }
    }

    job.set('result_data', resObj)
    job.set('status', 'done')
    job.set('query', 'test_seller_url')
    app.save(job)
  },
  (app) => {},
)
