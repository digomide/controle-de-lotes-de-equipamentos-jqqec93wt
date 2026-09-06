migrate(
  (app) => {
    const settingsList = app.findRecordsByFilter('ml_settings', '', '-created', 1, 0)
    if (!settingsList || settingsList.length === 0) return
    const s = settingsList[0]
    let token = s.getString('access_token')

    let prod = null
    try {
      const res = $http.send({
        url: 'https://api.mercadolibre.com/products/MLB50747892',
        method: 'GET',
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
        timeout: 15,
      })
      prod = res.json
    } catch (_) {}

    const r = app.findFirstRecordByData('ml_catalog_publish_jobs', 'id', 'uc82hebcvxq2og7')
    r.set(
      'error_message',
      JSON.stringify({
        parent_id: prod?.parent_id,
        family_id: prod?.family_id,
        children_ids: prod?.children_ids,
        status: prod?.status,
        site_id: prod?.site_id,
        settings: prod?.settings,
        item_conditions: prod?.item_conditions,
      }),
    )
    app.save(r)
  },
  (app) => {},
)
