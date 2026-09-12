/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 0476: Imprimir todas as chaves de 47982466891 de uma forma que possamos ver cada uma
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
        // Juntar todas as chaves
        const keys = Object.keys(res.json)
        order.set(
          'status_detail',
          'K1-25: ' + keys.slice(0, 25).join(',') + ' | K26+: ' + keys.slice(25).join(','),
        )
        app.save(order)
      }
    } catch (_) {}
  },
  (app) => {},
)
