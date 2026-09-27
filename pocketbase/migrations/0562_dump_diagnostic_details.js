/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 0562_dump_diagnostic_details:
    const rec = app.findFirstRecordByFilter('ml_item_queue', 'id = "bnun4b8qp6o1y0n"')
    if (!rec) return
    const res = rec.get('result') || {}
    const rawResult = JSON.stringify(res)
    // recortar primeiros 500 caracteres em error_message e ml_item_id
    rec.set('error_message', rawResult.substring(0, 250))
    rec.set('ml_item_id', rawResult.substring(250, 500))
    app.save(rec)
  },
  (app) => {},
)
