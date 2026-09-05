migrate(
  (app) => {
    // 1. Obter token
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    const token = sRecords[0].getString('access_token')

    // 2. Investigar MLB2097858038
    const r2097 = $http.send({
      url: 'https://api.mercadolibre.com/products/MLB2097858038',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 10,
    })

    // 3. Testar GET /products/search com ITEM_CONDITION=2230581 e variações
    const tests = [
      {
        name: 'family_dell_5420',
        url: 'https://api.mercadolibre.com/products/search?status=active&site_id=MLB&q=Dell%20Latitude%205420&ITEM_CONDITION=2230581&limit=20',
      },
      {
        name: 'family_dell_5420_condition_refurbished',
        url: 'https://api.mercadolibre.com/products/search?status=active&site_id=MLB&q=Dell%20Latitude%205420&condition=refurbished&limit=20',
      },
      {
        name: 'family_dell_5420_status_refurbished',
        url: 'https://api.mercadolibre.com/products/search?status=active&site_id=MLB&q=Dell%20Latitude%205420%20recondicionado&limit=20',
      },
      {
        name: 'family_dell_5420_filter_ITEM_CONDITION',
        url: 'https://api.mercadolibre.com/products/search?status=active&site_id=MLB&q=Dell%20Latitude%205420&filters=ITEM_CONDITION:2230581&limit=20',
      },
      {
        name: 'family_dell_5420_attribute_ITEM_CONDITION',
        url: 'https://api.mercadolibre.com/products/search?status=active&site_id=MLB&q=Dell%20Latitude%205420&attributes=ITEM_CONDITION:2230581&limit=20',
      },
      {
        name: 'family_dell_5420_item_condition_id',
        url: 'https://api.mercadolibre.com/products/search?status=active&site_id=MLB&q=Dell%20Latitude%205420&item_condition_id=2230581&limit=20',
      },
      {
        name: 'family_dell_5420_GRADING',
        url: 'https://api.mercadolibre.com/products/search?status=active&site_id=MLB&q=Dell%20Latitude%205420&GRADING=Excelente&limit=20',
      },
      {
        name: 'family_dell_5420_raw',
        url: 'https://api.mercadolibre.com/products/search?status=active&site_id=MLB&q=Dell%20Latitude%205420&limit=50',
      },
    ]

    const testResults = []
    for (let t = 0; t < tests.length; t++) {
      try {
        const tr = $http.send({
          url: tests[t].url,
          method: 'GET',
          headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
          timeout: 10,
        })
        const resList = tr.json && tr.json.results ? tr.json.results : []
        const has2097 = resList.some((r) => r.id === 'MLB2097858038')
        const refurbItems = resList
          .filter((r) => {
            const tLower = (r.name || r.title || '').toLowerCase()
            return (
              tLower.includes('recondicionado') ||
              tLower.includes('refurbished') ||
              (r.attributes || []).some((a) => (a.id || '').toUpperCase() === 'GRADING')
            )
          })
          .map((r) => ({ id: r.id, name: r.name }))

        testResults.push({
          name: tests[t].name,
          statusCode: tr.statusCode,
          total: tr.json && tr.json.paging ? tr.json.paging.total : null,
          resultsCount: resList.length,
          has2097: has2097,
          refurbCount: refurbItems.length,
          refurbSamples: refurbItems.slice(0, 3),
        })
      } catch (e) {
        testResults.push({ name: tests[t].name, error: String(e) })
      }
    }

    const col = app.findCollectionByNameOrId('ml_ads_fetch_jobs')
    const report = new Record(col)
    report.set('status', 'done')
    report.set('status_filter', '__PROBE_REFURB_API__')
    report.set(
      'progress_text',
      'prod2097 status: ' +
        r2097.statusCode +
        ' family_name: ' +
        (r2097.json ? r2097.json.family_name : ''),
    )
    report.set(
      'error_message',
      JSON.stringify({
        prod2097: {
          id: r2097.json ? r2097.json.id : null,
          name: r2097.json ? r2097.json.name : null,
          domain_id: r2097.json ? r2097.json.domain_id : null,
          parent_id: r2097.json ? r2097.json.parent_id : null,
          family_name: r2097.json ? r2097.json.family_name : null,
          children_ids: r2097.json ? r2097.json.children_ids : null,
          attributes: (r2097.json && r2097.json.attributes ? r2097.json.attributes : []).filter(
            (a) =>
              ['BRAND', 'MODEL', 'GRADING', 'ITEM_CONDITION'].includes((a.id || '').toUpperCase()),
          ),
        },
        testResults: testResults,
      }).substring(0, 3990),
    )
    app.save(report)
  },
  (app) => {},
)
