migrate(
  (app) => {
    // 0262: Testar se parent de MLB2097858038 existe e tem children
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    const token = sRecords.length > 0 ? sRecords[0].getString('access_token') : ''

    let pRes = $http.send({
      url: 'https://api.mercadolibre.com/products/MLB2097858038',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 10,
    })

    let parentRes = null
    if (pRes.statusCode === 200 && pRes.json && pRes.json.parent_id) {
      parentRes = $http.send({
        url: 'https://api.mercadolibre.com/products/' + pRes.json.parent_id,
        method: 'GET',
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
        timeout: 10,
      })
    }

    const col = app.findCollectionByNameOrId('ml_ads_fetch_jobs')
    const diag = new Record(col)
    diag.set('status', 'done')
    diag.set('status_filter', '__PARENT_PROBE__')
    diag.set(
      'progress_text',
      'parentId: ' +
        (pRes.json ? pRes.json.parent_id : 'null') +
        ' parentStatus: ' +
        (parentRes ? parentRes.statusCode : 'none'),
    )
    diag.set(
      'error_message',
      JSON.stringify({
        p2097_parent_id: pRes.json?.parent_id,
        parent_children: parentRes?.json?.children_ids,
        parent_name: parentRes?.json?.name,
      }),
    )
    app.save(diag)
  },
  (app) => {},
)
