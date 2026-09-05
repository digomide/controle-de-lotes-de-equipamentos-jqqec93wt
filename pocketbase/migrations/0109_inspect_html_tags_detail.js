migrate(
  (app) => {
    // 0109_inspect_html_tags_detail.js
    // Investigar por que o HTML da página veio sem og:title
    // Vamos baixar a página pública completa e inspecionar os primeiros 3000 caracteres!
    const realUrl =
      'https://www.mercadolivre.com.br/dell-g7-15-i7-1135g7-16gb-256-m2-cor-preto-excelente-recondicionado/p/MLB2010941196'

    const pRes = $http.send({
      url: realUrl,
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      timeout: 15,
    })

    const raw = pRes.raw || ''

    // Pegar o bloco <head>...</head>
    const headMatch = raw.match(/<head[^>]*>([\s\S]*?)<\/head>/i)
    const headContent = headMatch ? headMatch[1] : ''

    // Procurar todas as meta tags dentro do head
    const metaTags = []
    const metaRe = /<meta[^>]+>/gi
    let m
    while ((m = metaRe.exec(headContent)) !== null && metaTags.length < 20) {
      metaTags.push(m[0])
    }

    const rec = app.findFirstRecordByData('ml_competitors', 'seller_id', 'diag_test')
    rec.set(
      'notes',
      JSON.stringify({
        status: pRes.statusCode,
        headLen: headContent.length,
        metaCount: metaTags.length,
        sampleMetas: metaTags.slice(0, 5),
      }).substring(0, 500),
    )
    app.save(rec)
  },
  (app) => {},
)
