/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 0479: Inspecionar body de /lead_time e /delays
    const order = app.findRecordById('ml_orders', 't9dtytx3o33xqhm')
    if (order && order.getString('status_detail')) {
      const parsed = JSON.parse(
        order.getString('status_detail').replace('LT: ', '').split(' || DELAYS: ')[0],
      )
      const delaysParsed = JSON.parse(
        order.getString('status_detail').split(' || DELAYS: ')[1] || '{}',
      )

      const ltKeys = Object.keys(parsed.body || {})
      const delaysBody = delaysParsed.body || {}

      order.set(
        'status_detail',
        'LT_KEYS: ' +
          ltKeys.join(',') +
          ' | DELAYS: ' +
          JSON.stringify(delaysBody) +
          ' | EST_HANDLING: ' +
          JSON.stringify(parsed.body?.estimated_handling_limit) +
          ' | DELAY: ' +
          JSON.stringify(parsed.body?.delay),
      )
      app.save(order)
    }
  },
  (app) => {},
)
