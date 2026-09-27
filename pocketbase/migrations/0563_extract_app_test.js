/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 0563_extract_app_test:
    const rec = app.findFirstRecordByFilter('ml_item_queue', 'id = "bnun4b8qp6o1y0n"')
    if (!rec) return
    const rawResult = rec.getString('result')
    // PocketBase json field might be returned as JSON object or byte array
    let parsed = null
    try {
      parsed = JSON.parse(rawResult)
    } catch (_) {
      parsed = rec.get('result')
    }

    const appJson = (parsed && parsed.app_test && parsed.app_test.json) || {}
    const scopes = appJson.scopes || []
    const scopesStr = Array.isArray(scopes) ? scopes.join(' | ') : String(scopes)

    const stockTest = (parsed && parsed.stock_test) || {}
    const stockCode = stockTest.statusCode || 'no_code'
    const stockRaw = stockTest.raw || stockTest.error || ''

    rec.set('error_message', ('SCOPES: ' + scopesStr).substring(0, 250))
    rec.set('ml_item_id', ('STOCK: ' + stockCode + ' ' + stockRaw).substring(0, 250))
    app.save(rec)
  },
  (app) => {},
)
