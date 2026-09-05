migrate(
  (app) => {
    const rec = app.findFirstRecordByFilter(
      'ml_ads_fetch_jobs',
      "status_filter = '__DIAG_INSPIRON_3576__'",
    )
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    let token = sRecords.length > 0 ? sRecords[0].getString('access_token') : ''

    let htmlRes = ''
    try {
      const res = $http.send({
        url: 'https://produto.mercadolivre.com.br/MLB-7591024470-dell-inspiron-inspiron-15-3576-_JM',
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9',
        },
        timeout: 10,
      })
      if (res.statusCode === 200) {
        const body = res.raw || ''
        // Procurar MLB seguido de dígitos
        const matches = body.match(/MLB-?[0-9]{8,12}/g) || []
        const pMatches = body.match(/\/p\/MLB[0-9]+/g) || []
        const catProdMatches = body.match(/"catalog_product_id"\s*:\s*"([^"]+)"/g) || []
        const jsonLd = (
          body.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || []
        ).slice(0, 3)

        htmlRes = JSON.stringify({
          len: body.length,
          pMatches: pMatches.slice(0, 5),
          catProdMatches: catProdMatches.slice(0, 5),
          sampleMlbs: Array.from(new Set(matches)).slice(0, 10),
          hasRecondicionado:
            body.includes('Status do recondicionado') || body.includes('recondicionado'),
        })
      } else {
        htmlRes = 'status ' + res.statusCode
      }
    } catch (e) {
      htmlRes = 'err: ' + String(e)
    }

    rec.set('progress_text', 'html: ' + htmlRes.substring(0, 200))
    rec.set('error_message', htmlRes)
    app.save(rec)
  },
  (app) => {},
)
