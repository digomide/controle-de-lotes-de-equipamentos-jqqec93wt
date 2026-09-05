migrate(
  (app) => {
    // 0251: Testar o que acontece ao buscar anúncios do próprio vendedor por termo:
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    const token = sRecords.length > 0 ? sRecords[0].getString('access_token') : ''
    const sellerId = sRecords.length > 0 ? sRecords[0].getString('user_id_ml') : '626774396'

    // O usuário tem 564 anúncios sincronizados em ml_ads_fetch_jobs.
    // Vamos inspecionar exatamente como o job de busca no catálogo pode colher os anúncios da conta:
    // Fonte 1: da tabela ml_ads_fetch_jobs mais recente (status = 'done')
    // Fonte 2: da tabela products (produtos cadastrados com catalog_product_id ou ml_listing_id)
    // Fonte 3: da API direta /users/{seller_id}/items/search?q={termo} ou /items/MLB7566...

    // Teste: buscar itens do vendedor por termo na API
    let searchResApi = null
    try {
      const res = $http.send({
        url: 'https://api.mercadolibre.com/users/' + sellerId + '/items/search?q=5420',
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
        timeout: 10,
      })
      searchResApi = { status: res.statusCode, results: res.json ? res.json.results : [] }
    } catch (e) {
      searchResApi = { error: String(e) }
    }

    // Teste 2: verificar itens em ml_ads_fetch_jobs
    let localAdMatches = []
    const adsJobs = app.findRecordsByFilter(
      'ml_ads_fetch_jobs',
      "status = 'done' && items_count > 0",
      '-created',
      1,
      0,
    )
    if (adsJobs.length > 0) {
      const raw = adsJobs[0].get('items')
      if (Array.isArray(raw)) {
        for (let i = 0; i < raw.length; i++) {
          const item = raw[i]
          const title = (item.title || '').toLowerCase()
          if (title.includes('5420') || title.includes('latitude')) {
            localAdMatches.push({
              id: item.id,
              title: item.title,
              catalog_product_id: item.catalog_product_id,
              condition: item.condition,
              condition_grade: item.condition_grade,
              status: item.status,
            })
          }
        }
      }
    }

    // Atualizar registro k90p3eragks1xv9 (já existente no banco) para ver via db_describe_object se precisarmos
    // Ou testJob __PROBE_0243_VIEW__
    const rec = app.findFirstRecordByData('ml_catalog_search_jobs', 'query', '__PROBE_0243_VIEW__')
    if (rec) {
      rec.set('strategy_used', 'probe_0251')
      rec.set(
        'progress_text',
        'localAdMatches: ' +
          localAdMatches.length +
          ' apiResults: ' +
          (searchResApi.results ? searchResApi.results.length : 'err'),
      )
      rec.set('results', localAdMatches)
      rec.set('raw_debug', [JSON.stringify(searchResApi), JSON.stringify(localAdMatches)])
      app.save(rec)
    }
  },
  (app) => {},
)
