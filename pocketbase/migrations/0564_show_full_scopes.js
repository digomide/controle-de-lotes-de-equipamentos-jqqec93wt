/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 0564_show_full_scopes:
    const rec = app.findFirstRecordByFilter('ml_item_queue', 'id = "bnun4b8qp6o1y0n"')
    if (!rec) return
    const rawResult = rec.getString('result')
    let parsed = null
    try {
      parsed = JSON.parse(rawResult)
    } catch (_) {
      parsed = rec.get('result')
    }
    const appJson = (parsed && parsed.app_test && parsed.app_test.json) || {}
    const scopes = appJson.scopes || []

    // Part 1: scopes 0 to 4
    rec.set('error_message', JSON.stringify(scopes.slice(0, 4)))
    // Part 2: scopes 4 to end
    rec.set('ml_item_id', JSON.stringify(scopes.slice(4)))
    app.save(rec)
  },
  (app) => {},
)
