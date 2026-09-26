migrate(
  (app) => {
    // 0519_diagnose_policy_agent.js
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

    // 1. GET /users/me
    const meRes = $http.send({
      url: 'https://api.mercadolibre.com/users/me',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + accessToken },
      timeout: 15,
    })
    const me = meRes.json || {}

    // 2. GET /items/MLB5195337721
    const itemRes = $http.send({
      url: 'https://api.mercadolibre.com/items/MLB5195337721',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + accessToken },
      timeout: 15,
    })
    const item = itemRes.json || {}

    // 3. GET /items/MLB5195337721 com subrecursos
    // Testar se variations existem
    const varsCount = Array.isArray(item.variations) ? item.variations.length : 0

    const summary =
      'ME_ID=' +
      me.id +
      ' ME_NICK=' +
      me.nickname +
      ' ITEM_SELLER=' +
      item.seller_id +
      ' ITEM_STATUS=' +
      item.status +
      ' CATALOG_LIST=' +
      item.catalog_listing +
      ' VARS=' +
      varsCount +
      ' PARENT=' +
      item.parent_item_id

    const col = app.findCollectionByNameOrId('ml_item_queue')
    const q = new Record(col)
    q.set('action', 'update_price')
    q.set('ml_item_id', 'MLB5195337721')
    q.set('new_price', 3500)
    q.set('status', 'error')
    q.set('error_message', summary.substring(0, 500))
    app.save(q)
  },
  (app) => {},
)
