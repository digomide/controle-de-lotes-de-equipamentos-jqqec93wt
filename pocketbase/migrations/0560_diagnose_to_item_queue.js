/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 0560_diagnose_to_item_queue:
    // Cria registros de teste em ml_item_queue para testar PUT available_quantity e PUT price
    // e capturar os detalhes completos
    const settings = app.findFirstRecordByFilter('ml_settings', 'tenant_id = "ambicorpmestre1"')
    if (!settings) return

    const accessToken = settings.getString('access_token')
    const testItemId = 'MLB7591024470'

    // Teste direto de stock via $http para capturar o payload exato retornado pelo ML
    let stockResult = null
    try {
      const res = $http.send({
        url: 'https://api.mercadolibre.com/items/' + testItemId,
        method: 'PUT',
        headers: {
          Authorization: 'Bearer ' + accessToken,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ available_quantity: 1 }),
        timeout: 15,
      })
      stockResult = {
        statusCode: res.statusCode,
        headers: res.headers,
        raw: res.raw,
        json: res.json,
      }
    } catch (e) {
      stockResult = { error: String(e) }
    }

    // Teste de consulta de aplicação / grants do usuário
    let appResult = null
    try {
      const aRes = $http.send({
        url: 'https://api.mercadolibre.com/applications/253167816099623',
        method: 'GET',
        headers: { Authorization: 'Bearer ' + accessToken },
        timeout: 15,
      })
      appResult = {
        statusCode: aRes.statusCode,
        raw: aRes.raw,
        json: aRes.json,
      }
    } catch (e) {
      appResult = { error: String(e) }
    }

    // Salvar num registro de teste em ml_item_queue para podermos ler com db_query
    const queueRecord = new Record(app.findCollectionByNameOrId('ml_item_queue'))
    queueRecord.set('ml_item_id', testItemId)
    queueRecord.set('action', 'update_stock')
    queueRecord.set('status', 'done')
    queueRecord.set('error_message', 'DIAGNOSTICO_0560')
    queueRecord.set('result', {
      stock_test: stockResult,
      app_test: appResult,
      token_prefix: accessToken ? accessToken.substring(0, 15) : '',
    })
    queueRecord.set('tenant_id', 'ambicorpmestre1')
    app.save(queueRecord)
  },
  (app) => {},
)
