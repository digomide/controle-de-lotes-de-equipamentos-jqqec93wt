/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 0489: Limpar status_detail e ver todas as chaves do MAP retornado por /billing_info
    const ord = app.findFirstRecordByFilter('ml_orders', "order_id = '2000018410071220'")
    if (ord) {
      ord.set('status_detail', '')
      app.save(ord)
    }
  },
  (app) => {},
)
