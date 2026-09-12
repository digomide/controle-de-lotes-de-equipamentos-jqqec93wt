/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 0471: Listar todas as chaves de /shipments/47982466891
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
        const keys = Object.keys(res.json)
        // Procurar chaves relacionadas a handling ou limit ou estimated
        const related = {}
        for (let i = 0; i < keys.length; i++) {
          const k = keys[i]
          if (
            k.includes('limit') ||
            k.includes('handling') ||
            k.includes('estimate') ||
            k.includes('date') ||
            k.includes('time') ||
            k.includes('sla') ||
            k.includes('buff') ||
            k.includes('lead')
          ) {
            related[k] = res.json[k]
          }
        }
        const order = app.findRecordById('ml_orders', 't9dtytx3o33xqhm')
        order.set(
          'status_detail',
          'KEYS: ' + keys.join(', ') + ' || REL: ' + JSON.stringify(related),
        )
        app.save(order)
      }
    } catch (_) {}
  },
  (app) => {},
)
