migrate(
  (app) => {
    const pRes = $http.send({
      url: 'https://www.mercadolivre.com.br/p/MLB24436934',
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
      timeout: 12,
    })
    const html = pRes.raw || ''

    // Verificar título da página
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i)
    const isRobot =
      html.indexOf('robot') >= 0 || html.indexOf('suspicious') >= 0 || html.indexOf('captcha') >= 0

    // Procurar "disponív"
    const dispIdx = html.toLowerCase().indexOf('disponív')
    const dispSnippet =
      dispIdx >= 0
        ? html
            .substring(Math.max(0, dispIdx - 50), Math.min(html.length, dispIdx + 80))
            .replace(/\s+/g, ' ')
        : null

    // Procurar classes de preço ou seller
    const priceMatches =
      html.match(/class=["'][^"']*andes-money-amount__fraction[^"']*["']>([^<]+)<\/span>/gi) || []

    const job = app.findFirstRecordByData('ml_catalog_search_jobs', 'id', 'szg3o742i7qawmh')
    job.set(
      'error_message',
      JSON.stringify({
        title: titleMatch ? titleMatch[1] : null,
        isRobot: isRobot,
        dispSnippet: dispSnippet,
        priceMatches: priceMatches.slice(0, 5),
      }),
    )
    app.save(job)
  },
  (app) => {},
)
