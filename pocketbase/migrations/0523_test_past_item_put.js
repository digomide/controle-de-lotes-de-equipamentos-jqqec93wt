migrate(
  (app) => {
    // 0523_test_past_item_put.js
    let settings = null
    try {
      const sRecords = app.findRecordsByFilter(
        'ml_settings',
        'tenant_id = "ambicorpmestre1"',
        '-created',
        1,
        0,
      )
      if (sRecords && sRecords.length > 0) settings = sRecords[0]
    } catch (_) {}
    if (!settings) return
    const accessToken = settings.getString('access_token')

    // Pegar o job 0522
    const lastJob = app.findRecordsByFilter(
      'ml_competitor_jobs',
      'query = "policy_agent_root_cause"',
      '-created',
      1,
      0,
    )
    const diagMsg = lastJob && lastJob.length > 0 ? lastJob[0].getString('error_message') : 'none'

    // Testar PUT no item MLB7637604840 com o mesmo preço atual dele
    const gPast = $http.send({
      url: 'https://api.mercadolibre.com/items/MLB7637604840',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + accessToken },
      timeout: 10,
    })
    const pastPrice = gPast.json?.price || 2500

    const putPast = $http.send({
      url: 'https://api.mercadolibre.com/items/MLB7637604840',
      method: 'PUT',
      headers: {
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ price: pastPrice }),
      timeout: 10,
    })

    const summary = {
      diag522: diagMsg,
      pastItemPutStatus: putPast.statusCode,
      pastItemPutRaw: putPast.raw,
    }

    const col = app.findCollectionByNameOrId('ml_competitor_jobs')
    const rec = new Record(col)
    rec.set('action', 'search_query')
    rec.set('status', 'done')
    rec.set('query', 'past_item_comparison')
    rec.set('error_message', JSON.stringify(summary).substring(0, 800))
    app.save(rec)
  },
  (app) => {},
)
