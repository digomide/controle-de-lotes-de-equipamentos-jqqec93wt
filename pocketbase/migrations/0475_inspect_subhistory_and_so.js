/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 0475: Inspecionar chaves específicas do JSON de 47982466891
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
        const j = res.json
        const pick = {
          substatus_history: j.substatus_history,
          shipping_option: j.shipping_option,
          logistic_type: j.logistic_type,
          tags: j.tags,
          sibling: j.sibling,
          source: j.source,
          origin: j.origin,
          destination: j.destination,
        }
        order.set('status_detail', JSON.stringify(pick))
        app.save(order)
      }
    } catch (_) {}
  },
  (app) => {},
)
