/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 0473: Extrair valores pontuais de shipping_option e lead_time
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
        const so = res.json.shipping_option || {}
        const lt = res.json.lead_time || {}

        order.set(
          'status_detail',
          'EST_HANDLING: ' +
            JSON.stringify(so.estimated_handling_limit) +
            ' | BUFF: ' +
            JSON.stringify(so.buffering) +
            ' | EST_SCHED: ' +
            JSON.stringify(so.estimated_schedule) +
            ' | LT: ' +
            JSON.stringify(lt),
        )
        app.save(order)
      }
    } catch (_) {}
  },
  (app) => {},
)
