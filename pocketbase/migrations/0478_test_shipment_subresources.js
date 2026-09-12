/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 0478: Limpar status_detail de teste e verificar endpoints adicionais de shipments
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (!sRecords || sRecords.length === 0) return
    const settings = sRecords[0]
    const accessToken = settings.getString('access_token')
    if (!accessToken) return

    // 1. Restaurar status_detail dos pedidos limpo
    try {
      const o1 = app.findRecordById('ml_orders', 't9dtytx3o33xqhm')
      if (o1) {
        o1.set('status_detail', '')
        app.save(o1)
      }
      const o2 = app.findRecordById('ml_orders', 'v92xa3wcs5iv0o0')
      if (o2) {
        o2.set('status_detail', '')
        app.save(o2)
      }
    } catch (_) {}

    // 2. Testar /shipments/47982466891/lead_time ou /shipments/47982466891/delays ou /shipments/47982466891/handling
    let leadTimeRes = null
    try {
      const res = $http.send({
        url: 'https://api.mercadolibre.com/shipments/47982466891/lead_time',
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + accessToken,
          Accept: 'application/json',
        },
        timeout: 10,
      })
      leadTimeRes = { status: res.statusCode, body: res.json }
    } catch (e) {
      leadTimeRes = { err: String(e) }
    }

    let delaysRes = null
    try {
      const res2 = $http.send({
        url: 'https://api.mercadolibre.com/shipments/47982466891/delays',
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + accessToken,
          Accept: 'application/json',
        },
        timeout: 10,
      })
      delaysRes = { status: res2.statusCode, body: res2.json }
    } catch (e2) {
      delaysRes = { err: String(e2) }
    }

    try {
      const o1 = app.findRecordById('ml_orders', 't9dtytx3o33xqhm')
      o1.set(
        'status_detail',
        'LT: ' + JSON.stringify(leadTimeRes) + ' || DELAYS: ' + JSON.stringify(delaysRes),
      )
      app.save(o1)
    } catch (_) {}
  },
  (app) => {},
)
