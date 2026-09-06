migrate(
  (app) => {
    const settingsList = app.findRecordsByFilter('ml_settings', '', '-created', 1, 0)
    if (!settingsList || settingsList.length === 0) return
    const s = settingsList[0]
    let token = s.getString('access_token')

    let searchResult = null
    try {
      const res = $http.send({
        url: 'https://api.mercadolibre.com/products/search?status=active&site_id=MLB&q=Latitude%205420%20recondicionado',
        method: 'GET',
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
        timeout: 15,
      })
      searchResult = (res.json?.results || []).map((p) => ({
        id: p.id,
        name: p.name,
        domain_id: p.domain_id,
        parent_id: p.parent_id,
      }))
    } catch (e) {
      searchResult = { err: String(e) }
    }

    const r = app.findFirstRecordByData('ml_catalog_publish_jobs', 'id', 'lo0rtbzlgq6a5el')
    r.set('error_message', JSON.stringify(searchResult).substring(0, 4000))
    app.save(r)
  },
  (app) => {},
)
