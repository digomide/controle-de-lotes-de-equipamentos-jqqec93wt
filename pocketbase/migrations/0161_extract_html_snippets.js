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

    // Encontrar ocorrências de "novo", "usado", "recondicionado", "disponíve", "vendedor", "preço"
    const snippets = []
    const terms = ['novo', 'usado', 'recondicionado', 'disponív', 'estoque', 'seller', 'vendedor']
    for (let t = 0; t < terms.length; t++) {
      const term = terms[t]
      let idx = 0
      let count = 0
      while ((idx = html.toLowerCase().indexOf(term, idx)) !== -1 && count < 3) {
        const start = Math.max(0, idx - 40)
        const end = Math.min(html.length, idx + term.length + 60)
        snippets.push(term + ' -> ' + html.substring(start, end).replace(/\s+/g, ' '))
        idx += term.length + 20
        count++
      }
    }

    // Verificar se há scripts JSON
    const scriptMatches =
      html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || []
    const jsonLdSnippets = scriptMatches.map((s) =>
      s
        .replace(/<\/?script[^>]*>/gi, '')
        .trim()
        .substring(0, 200),
    )

    const job = app.findFirstRecordByData('ml_catalog_search_jobs', 'id', 'szg3o742i7qawmh')
    job.set(
      'error_message',
      JSON.stringify({
        snippets: snippets.slice(0, 10),
        jsonLd: jsonLdSnippets,
      }),
    )
    app.save(job)
  },
  (app) => {},
)
