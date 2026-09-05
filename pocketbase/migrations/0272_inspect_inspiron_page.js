migrate(
  (app) => {
    const rec = app.findFirstRecordByFilter(
      'ml_ads_fetch_jobs',
      "status_filter = '__DIAG_INSPIRON_3576__'",
    )
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    let token = sRecords.length > 0 ? sRecords[0].getString('access_token') : ''

    let pageHtmlSample = ''
    let catalogUrlInPage = ''
    let catalogIdMatch = null
    let rawItem = null

    if (token) {
      try {
        const itemRes = $http.send({
          url: 'https://api.mercadolibre.com/items/MLB7591024470',
          method: 'GET',
          headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
          timeout: 10,
        })
        if (itemRes.statusCode === 200 && itemRes.json) {
          rawItem = itemRes.json
        }
      } catch (e) {}
    }

    // Baixar página pública
    try {
      const pageRes = $http.send({
        url: 'https://produto.mercadolivre.com.br/MLB-7591024470-dell-inspiron-inspiron-15-3576-_JM',
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 10,
      })
      if (pageRes.statusCode === 200) {
        const html = pageRes.raw || ''
        // Procurar /p/MLB... ou catalog_product_id ou data-catalog-product-id
        const pMatch = html.match(/\/p\/(MLB[0-9]+)/i)
        if (pMatch) {
          catalogUrlInPage = pMatch[0]
          catalogIdMatch = pMatch[1]
        }
        // Outros padrões
        const catMatch2 = html.match(/"catalog_product_id"\s*:\s*"([^"]+)"/i)
        const catMatch3 = html.match(/data-catalog-product-id\s*=\s*"([^"]+)"/i)
        const catMatch4 = html.match(/\/p\/(MLB-P-[0-9]+)/i)
        const isCatalog =
          html.includes('ui-pdp-buybox') || html.includes('catalogo') || html.includes('/p/')

        pageHtmlSample = JSON.stringify({
          status: pageRes.statusCode,
          pMatch: pMatch ? pMatch[1] : null,
          catMatch2: catMatch2 ? catMatch2[1] : null,
          catMatch3: catMatch3 ? catMatch3[1] : null,
          catMatch4: catMatch4 ? catMatch4[1] : null,
          hasBuybox: html.includes('ui-pdp-buybox'),
          hasStatusRecondicionado: html.includes('Status do recondicionado'),
          titleInHtml: (html.match(/<title>([^<]+)<\/title>/i) || [])[1] || null,
        })
      } else {
        pageHtmlSample = 'page status: ' + pageRes.statusCode
      }
    } catch (e) {
      pageHtmlSample = 'page error: ' + String(e)
    }

    rec.set(
      'progress_text',
      'catalogIdMatch: ' +
        (catalogIdMatch || 'none') +
        ' htmlSummary: ' +
        pageHtmlSample.substring(0, 100),
    )
    rec.set('error_message', pageHtmlSample)
    app.save(rec)
  },
  (app) => {},
)
