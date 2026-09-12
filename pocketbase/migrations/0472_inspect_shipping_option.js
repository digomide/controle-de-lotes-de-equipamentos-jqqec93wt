/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 0472: Imprimir lead_time e shipping_option de 47982466891
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
        const sd = res.json.shipping_items || []
        const delay = res.json.delay || {}
        const sla = res.json.sla || {}
        order.set(
          'status_detail',
          JSON.stringify({
            so_keys: Object.keys(so),
            so_est_handling_limit: so.estimated_handling_limit,
            so_handling_limit: so.handling_limit,
            so_buffering: so.buffering,
            so_estimated_delivery_time: so.estimated_delivery_time,
            so_estimated_delivery_limit: so.estimated_delivery_limit,
            so_estimated_schedule: so.estimated_schedule,
            lt: lt,
            delay: delay,
            sla: sla,
            first_shipping_item: sd[0],
          }),
        )
        app.save(order)
      }
    } catch (_) {}
  },
  (app) => {},
)
