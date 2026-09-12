/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 0474: Inspecionar todas as chaves e valores não nulos do payload de 47982466891 e 47977020575
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (!sRecords || sRecords.length === 0) return
    const settings = sRecords[0]
    const accessToken = settings.getString('access_token')
    if (!accessToken) return

    try {
      const res = $http.send({
        url: 'https://api.mercadolibre.com/shipments/47982466891',
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + accessToken,
          Accept: 'application/json',
        },
        timeout: 10,
      })
      if (res.statusCode === 200 && res.json) {
        const order = app.findRecordById('ml_orders', 't9dtytx3o33xqhm')
        const nonNulls = {}
        const keys = Object.keys(res.json)
        for (let i = 0; i < keys.length; i++) {
          const k = keys[i]
          const val = res.json[k]
          if (val !== null && val !== undefined && val !== '') {
            if (typeof val === 'object') {
              nonNulls[k] = Object.keys(val)
            } else {
              nonNulls[k] = val
            }
          }
        }
        order.set('status_detail', 'NON_NULLS: ' + JSON.stringify(nonNulls))
        app.save(order)
      }
    } catch (_) {}
  },
  (app) => {},
)
