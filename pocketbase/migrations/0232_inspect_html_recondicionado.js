migrate(
  (app) => {
    // 1. Carregar token ML
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    const token = sRecords[0].getString('access_token')

    // 2. Testar busca no Mercado Livre:
    // A query "dell latitude 5420 recondicionado"
    // No job sm8z9ydvm33r535, a busca no endpoint:
    // https://api.mercadolibre.com/products/search?status=active&site_id=MLB&q=dell%20latitude%205420%20recondicionado&limit=50&offset=0
    // retornou total: 6667!
    // POR QUE total: 6667? Porque o ML trata como OR de termos ou busca ampla!
    // E o que acontece com variações mais específicas de busca de recondicionado na API /products/search:
    // 1) q="Latitude 5420 Recondicionado"
    // 2) q="Dell 5420 Recondicionado"
    // 3) q="5420 Recondicionado"
    // 4) q="Latitude 5420" com ITEM_CONDITION no /products/search? (vimos que available_filters é vazio)
    // 5) q="Latitude 5420" ordenado ou filtrado:
    // O que acontece com a busca por "Latitude 5420"? Total 3698.
    // 6) E no scraping: por que o scraping retornou 0?
    // Porque a regex /href=["'](https?:\/\/[^"']*mercadolivre\.com\.br\/p\/(MLB[0-9]+)[^"']*)["']/gi
    // precisa conferir como os links /p/MLB aparecem no HTML das páginas de busca do ML!

    // Vamos testar uma requisição GET para https://lista.mercadolivre.com.br/dell-latitude-5420-recondicionado
    // e inspecionar se tem links /p/ ou data-item-id ou class ou /MLB- ou /p/
    const pageRes = $http.send({
      url: 'https://lista.mercadolivre.com.br/dell-latitude-5420-recondicionado',
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
      timeout: 10,
    })

    const html = pageRes.raw || ''
    const has2097InHtml = html.indexOf('2097858038') >= 0
    const hasMLBInHtml = html.indexOf('/p/MLB') >= 0
    const pMatches = []
    const pRegex = /\/p\/(MLB[0-9]+)/g
    let m
    while ((m = pRegex.exec(html)) !== null) {
      pMatches.push(m[1])
    }
    const uniqueP = Array.from(new Set(pMatches))

    // E os links de anúncios comuns: /MLB-123456...
    const itemMatches = []
    const itemRegex = /(MLB-?[0-9]{8,12})/g
    while ((m = itemRegex.exec(html)) !== null) {
      itemMatches.push(m[1])
    }
    const uniqueItems = Array.from(new Set(itemMatches))

    const job = app.findFirstRecordByData('ml_catalog_search_jobs', 'id', 'zp64sd2gr6gkany')
    job.set(
      'progress_text',
      'htmlLen: ' +
        html.length +
        ' has2097: ' +
        has2097InHtml +
        ' pCount: ' +
        uniqueP.length +
        ' itemMatches: ' +
        uniqueItems.length,
    )
    job.set(
      'error_message',
      JSON.stringify({
        has2097InHtml: has2097InHtml,
        uniqueP: uniqueP.slice(0, 15),
        sampleHtmlSnippets: has2097InHtml
          ? html.substring(
              Math.max(0, html.indexOf('2097858038') - 100),
              html.indexOf('2097858038') + 200,
            )
          : '',
      }),
    )
    app.save(job)
  },
  (app) => {},
)
