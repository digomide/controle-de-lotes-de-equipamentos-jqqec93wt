migrate(
  (app) => {
    // 0096_format_string.js
    const job = app.findFirstRecordByData(
      'ml_competitor_jobs',
      'query',
      'probe_mlb_sources_2010941196',
    )
    const rawVal = job.get('result_data')
    // Se for byte array ou string ou objeto
    let parsed = rawVal
    if (typeof rawVal === 'string') {
      try {
        parsed = JSON.parse(rawVal)
      } catch (_) {}
    } else if (Array.isArray(rawVal) && typeof rawVal[0] === 'number') {
      // É slice de bytes Go
      const chars = []
      for (let i = 0; i < rawVal.length; i++) {
        chars.push(String.fromCharCode(rawVal[i]))
      }
      try {
        parsed = JSON.parse(chars.join(''))
      } catch (_) {}
    }

    const prod = parsed.productEndpointAuth || {}
    const page = parsed.realPage || {}

    const summary = [
      'PROD_AUTH: status=' + prod.status + ' name=' + prod.name,
      'PROD_NO_TOKEN: status=' +
        (parsed.productEndpointNoToken ? parsed.productEndpointNoToken.status : 'null'),
      'PAGE: status=' + page.status + ' len=' + page.length,
      'OG_TITLE: ' + page.ogTitle,
      'OG_PRICE: ' + page.ogPrice,
      'OG_IMAGE: ' + page.ogImage,
      'LD_COUNT: ' + page.ldJsonCount,
      'LD_SAMPLE: ' + (page.ldSample || ''),
      'PRICES: ' + JSON.stringify(page.priceMatches || []),
      'HAS_SELLER: ' + page.hasSeller,
    ].join('\n')

    job.set('error_message', summary)
    app.save(job)
  },
  (app) => {},
)
