migrate(
  (app) => {
    // 1. Carregar token ML
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    const token = sRecords[0].getString('access_token')

    // 2. O que retorna na busca pública de anúncios quando filtramos por recondicionado?
    // URL: https://lista.mercadolivre.com.br/dell-latitude-5420-recondicionado
    // No HTML da página, temos os links dos anúncios dos vendedores!
    // Cada anúncio na página de busca do ML tem um link do tipo:
    // https://produto.mercadolivre.com.br/MLB-7566367408-...
    // ou https://www.mercadolivre.com.br/notebook-dell-latitude-5420.../p/MLB2097858038
    //
    // Vamos extrair todos os links da página e testar se MLB2097858038 ou MLB7566367408 aparece!
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
    const has7566 = html.indexOf('7566367408') >= 0
    const has2097 = html.indexOf('2097858038') >= 0

    // E também: URL de busca pública com ordenação ou filtro de recondicionado
    // https://lista.mercadolivre.com.br/informatica/portateis/notebooks/dell-latitude-5420-recondicionado
    const job = app.findFirstRecordByData('ml_catalog_search_jobs', 'id', '85b8nijw2kay6k3')
    job.set(
      'progress_text',
      'has7566: ' + has7566 + ' has2097: ' + has2097 + ' htmlLen: ' + html.length,
    )
    job.set(
      'error_message',
      JSON.stringify({
        has7566: has7566,
        has2097: has2097,
      }),
    )
    app.save(job)
  },
  (app) => {},
)
