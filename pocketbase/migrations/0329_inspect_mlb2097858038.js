migrate(
  (app) => {
    const settingsList = app.findRecordsByFilter('ml_settings', '', '-created', 1, 0)
    if (!settingsList || settingsList.length === 0) return
    const s = settingsList[0]
    let token = s.getString('access_token')

    let itemInfo = null
    try {
      const res = $http.send({
        url: 'https://api.mercadolibre.com/items/MLB2097858038',
        method: 'GET',
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
        timeout: 15,
      })
      if (res.statusCode === 200 && res.json) {
        const j = res.json
        itemInfo = {
          id: j.id,
          condition: j.condition,
          catalog_product_id: j.catalog_product_id,
          catalog_listing: j.catalog_listing,
          item_conditions: (j.attributes || []).filter((a) => a.id === 'ITEM_CONDITION'),
        }
      }
    } catch (_) {}

    const r = app.findFirstRecordByData('ml_catalog_publish_jobs', 'id', 'lo0rtbzlgq6a5el')
    r.set('error_message', JSON.stringify({ itemInfo }))
    app.save(r)
  },
  (app) => {},
)
