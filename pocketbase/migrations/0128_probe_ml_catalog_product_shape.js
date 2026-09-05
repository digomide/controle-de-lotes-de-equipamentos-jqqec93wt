migrate(
  (app) => {
    const settings = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (!settings || settings.length === 0) return
    const s = settings[0]
    const token = s.getString('access_token')

    const res = $http.send({
      url: 'https://api.mercadolibre.com/products/MLB37239539',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 15,
    })

    if (res.statusCode === 200 && res.json) {
      const p = res.json
      const keys = Object.keys(p)
      s.set('site_id', JSON.stringify(keys))
      app.save(s)
    }
  },
  (app) => {},
)
