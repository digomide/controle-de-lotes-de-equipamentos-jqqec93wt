/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 0486: Desempacotar exatamente o que veio no body de /orders/2000018410071220/billing_info
    const ord = app.findFirstRecordByFilter('ml_orders', "order_id = '2000018410071220'")
    if (!ord) return
    const raw = ord.getString('status_detail')
    let parsed = {}
    try {
      parsed = JSON.parse(raw)
    } catch (_) {}

    const orderBilling = parsed['https://api.mercadolibre.com/orders/2000018410071220/billing_info']
    const shipBilling = parsed['https://api.mercadolibre.com/shipments/47992043858/billing_info']

    ord.set(
      'status_detail',
      'OB: ' + JSON.stringify(orderBilling) + ' || SB: ' + JSON.stringify(shipBilling),
    )
    app.save(ord)
  },
  (app) => {},
)
