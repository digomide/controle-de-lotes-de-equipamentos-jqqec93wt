migrate(
  (app) => {
    // 0522_clean_and_diagnose_policies.js
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

    // Consultar app info: GET https://api.mercadolibre.com/applications/{client_id}
    const clientId = settings.getString('client_id')
    const appRes = $http.send({
      url: 'https://api.mercadolibre.com/applications/' + clientId,
      method: 'GET',
      headers: { Authorization: 'Bearer ' + accessToken },
      timeout: 10,
    })
    const appInfo = appRes.json || {}

    // Consultar outro anúncio qualquer que foi atualizado com sucesso no passado (ex.: MLB7637604840)
    const testPast = $http.send({
      url: 'https://api.mercadolibre.com/items/MLB7637604840',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + accessToken },
      timeout: 10,
    })
    const pastItem = testPast.json || {}

    // Pegar o erro da migration 0521
    const lastQ = app.findRecordsByFilter(
      'ml_item_queue',
      'error_message ~ "QTY_ST="',
      '-created',
      1,
      0,
    )
    const qMsg = lastQ && lastQ.length > 0 ? lastQ[0].getString('error_message') : 'none'

    // Deletar as records de teste temporárias de ml_item_queue
    const testRecs = app.findRecordsByFilter(
      'ml_item_queue',
      'error_message ~ "DEBUG_" || error_message ~ "ME_ID=" || error_message ~ "VAR_PUT_" || error_message ~ "QTY_ST="',
      '-created',
      20,
      0,
    )
    for (let r of testRecs) {
      app.delete(r)
    }

    const diag = {
      app_scopes: appInfo.scopes,
      app_name: appInfo.name,
      app_status: appRes.statusCode,
      q521: qMsg,
      past_item_catalog: pastItem.catalog_listing,
      past_item_seller: pastItem.seller_id,
    }

    const col = app.findCollectionByNameOrId('ml_competitor_jobs')
    const rec = new Record(col)
    rec.set('action', 'search_query')
    rec.set('status', 'done')
    rec.set('query', 'policy_agent_root_cause')
    rec.set('error_message', JSON.stringify(diag).substring(0, 800))
    app.save(rec)
  },
  (app) => {},
)
