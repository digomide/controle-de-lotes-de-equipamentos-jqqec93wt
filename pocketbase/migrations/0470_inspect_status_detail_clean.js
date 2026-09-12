/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 0470: Imprimir detalhes de handling_limit e status_history em status_detail
    try {
      const order1 = app.findRecordById('ml_orders', 't9dtytx3o33xqhm')
      const order2 = app.findRecordById('ml_orders', 'v92xa3wcs5iv0o0')

      const s1 = JSON.parse(order1.getString('status_detail'))
      const s2 = JSON.parse(order2.getString('status_detail'))

      order1.set(
        'status_detail',
        'OLIVEIRA: hl=' +
          JSON.stringify(s1.handling_limit) +
          ' | sh=' +
          JSON.stringify(s1.status_history),
      )
      app.save(order1)

      order2.set(
        'status_detail',
        'BARBO: hl=' +
          JSON.stringify(s2.handling_limit) +
          ' | sh=' +
          JSON.stringify(s2.status_history),
      )
      app.save(order2)
    } catch (_) {}
  },
  (app) => {},
)
