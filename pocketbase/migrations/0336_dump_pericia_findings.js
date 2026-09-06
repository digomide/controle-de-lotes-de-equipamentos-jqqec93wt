migrate(
  (app) => {
    // 0336_dump_pericia_findings.js
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (!sRecords || sRecords.length === 0) return
    const token = sRecords[0].getString('access_token')

    const itemRes = $http.send({
      url: 'https://api.mercadolibre.com/items/MLB7566367408',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 10,
    })
    const it = itemRes.json || {}

    const prodRes = $http.send({
      url: 'https://api.mercadolibre.com/products/MLB2097858038',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 10,
    })
    const pr = prodRes.json || {}

    // Pegar o ITEM_CONDITION do item e do produto
    const itCondition = (it.attributes || []).find((a) => a.id === 'ITEM_CONDITION')
    const itGrading = (it.attributes || []).find((a) => a.id === 'GRADING')

    const prCondition = (pr.attributes || []).find((a) => a.id === 'ITEM_CONDITION')
    const prGrading = (pr.attributes || []).find((a) => a.id === 'GRADING')

    const col = app.findCollectionByNameOrId('ml_ads_fetch_jobs')
    const diag = new Record(col)
    diag.set('status', 'done')
    diag.set('status_filter', '__PERICIA_0336__')
    diag.set('progress_text', 'item condition: ' + it.condition + ' prod_name: ' + (pr.name || ''))
    diag.set(
      'error_message',
      JSON.stringify({
        item_condition_root: it.condition,
        item_catalog_product_id: it.catalog_product_id,
        itCondition: itCondition,
        itGrading: itGrading,
        prCondition: prCondition,
        prGrading: prGrading,
        prName: pr.name,
        prDomain: pr.domain_id,
        prStatus: pr.status,
      }),
    )
    app.save(diag)
  },
  (app) => {},
)
