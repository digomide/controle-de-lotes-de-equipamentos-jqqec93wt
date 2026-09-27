/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 0561_format_diagnostic_log:
    const rec = app.findFirstRecordByFilter('ml_item_queue', 'error_message = "DIAGNOSTICO_0560"')
    if (!rec) return
    const res = rec.get('result') || {}
    const stockTest = res.stock_test || {}
    const appTest = res.app_test || {}

    // Decompor em mensagens compactas no error_message para vermos diretamente via db_query
    const stockStatus = stockTest.statusCode || 'err'
    const stockHeaders = JSON.stringify(stockTest.headers || {})
    const stockRaw = stockTest.raw || ''
    const appScopes = appTest.json ? JSON.stringify(appTest.json.scopes) : 'no_scopes'

    rec.set('error_message', 'ST_CODE:' + stockStatus + ' | SCOPES:' + appScopes)
    rec.set('ml_item_id', stockRaw.length > 500 ? stockRaw.substring(0, 500) : stockRaw)
    app.save(rec)
  },
  (app) => {},
)
