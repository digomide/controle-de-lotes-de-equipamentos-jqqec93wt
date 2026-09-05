migrate(
  (app) => {
    // 1. Carregar token ML
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    const token = sRecords[0].getString('access_token')

    // 2. Testar busca com filtros no Mercado Livre
    // No ML lista pública, o filtro de recondicionado é ITEM_CONDITION:2230581 ou algo similar
    // Em /products/search da API, como filtrar por atributos?
    // Ex: /products/search?status=active&site_id=MLB&q=Dell%20Latitude%205420
    const resFilters = $http.send({
      url: 'https://api.mercadolibre.com/products/search?status=active&site_id=MLB&q=Dell%20Latitude%205420',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 10,
    })

    const filters = resFilters.json ? resFilters.json.available_filters || [] : []
    const conditionFilter = filters.find(
      (f) => f.id === 'ITEM_CONDITION' || f.id === 'condition' || f.id === 'GRADING',
    )

    // 3. Testar a busca pública web com filtro de recondicionado:
    // https://lista.mercadolivre.com.br/dell-latitude-5420_ITEM*CONDITION_2230581
    // ou https://lista.mercadolivre.com.br/dell-latitude-5420-recondicionado
    // ou https://lista.mercadolivre.com.br/informatica/dell-latitude-5420_ITEM*CONDITION_2230581
    const testUrls = [
      'https://lista.mercadolivre.com.br/dell-latitude-5420_ITEM*CONDITION_2230581',
      'https://lista.mercadolivre.com.br/notebook-dell-latitude-5420-recondicionado',
      'https://lista.mercadolivre.com.br/dell-latitude-5420-recondicionado',
      'https://lista.mercadolivre.com.br/dell-latitude-5420_Condition_Refurbished',
    ]

    const scrapeResults = []
    for (let u = 0; u < testUrls.length; u++) {
      try {
        const pageRes = $http.send({
          url: testUrls[u],
          method: 'GET',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9',
          },
          timeout: 12,
        })
        const html = pageRes.raw || ''
        const pRegex =
          /href=["'](https?:\/\/[^"']*mercadolivre\.com\.br\/p\/(MLB[0-9]+)[^"']*)["']/gi
        let match
        const found = []
        while ((match = pRegex.exec(html)) !== null) {
          found.push(match[2])
        }
        const unique = Array.from(new Set(found))
        scrapeResults.push({
          url: testUrls[u],
          status: pageRes.statusCode,
          catalogIdsCount: unique.length,
          has2097: unique.includes('MLB2097858038'),
          ids: unique.slice(0, 10),
        })
      } catch (err) {
        scrapeResults.push({ url: testUrls[u], error: String(err) })
      }
    }

    const col = app.findCollectionByNameOrId('ml_ads_fetch_jobs')
    const rec = new Record(col)
    rec.set('status', 'done')
    rec.set('status_filter', '__PROBE_SCRAPE_AND_FILTERS__')
    rec.set('progress_text', 'ConditionFilter: ' + JSON.stringify(conditionFilter))
    rec.set(
      'error_message',
      JSON.stringify({
        available_filter_ids: filters.map((f) => f.id),
        conditionFilter: conditionFilter,
        scrapeResults: scrapeResults,
      }).substring(0, 3990),
    )
    app.save(rec)
  },
  (app) => {},
)
