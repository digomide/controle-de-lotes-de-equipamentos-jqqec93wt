/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 0468: Teste e enriquecimento dos campos de envio de shipments
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (!sRecords || sRecords.length === 0) return
    const settings = sRecords[0]
    const accessToken = settings.getString('access_token')
    if (!accessToken) return

    // Consultar envio de OLIVEIRAGABRIEL shipping_id: 47982466891
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
      console.log('[0468] Resposta 47982466891: status=' + res.statusCode)
      if (res.json) {
        console.log(
          '[0468] estimated_handling_limit=' + JSON.stringify(res.json.estimated_handling_limit),
        )
        console.log('[0468] status_history=' + JSON.stringify(res.json.status_history))
        console.log('[0468] substatus_history=' + JSON.stringify(res.json.substatus_history))
        console.log(
          '[0468] dates: date_shipped=' +
            res.json.date_shipped +
            ', date_delivered=' +
            res.json.date_delivered,
        )
      }
    } catch (e) {
      console.log('[0468] Erro: ' + e)
    }

    // Consultar envio de BARBOLUCAS shipping_id: 47977020575
    try {
      const res2 = $http.send({
        url: 'https://api.mercadolibre.com/shipments/47977020575',
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + accessToken,
          Accept: 'application/json',
        },
        timeout: 10,
      })
      console.log('[0468] Resposta 47977020575 (BARBOLUCAS): status=' + res2.statusCode)
      if (res2.json) {
        console.log(
          '[0468] BARBOLUCAS estimated_handling_limit=' +
            JSON.stringify(res2.json.estimated_handling_limit),
        )
        console.log('[0468] BARBOLUCAS status_history=' + JSON.stringify(res2.json.status_history))
        console.log(
          '[0468] BARBOLUCAS dates: date_shipped=' +
            res2.json.date_shipped +
            ', date_delivered=' +
            res2.json.date_delivered,
        )
      }
    } catch (e2) {
      console.log('[0468] Erro BARBOLUCAS: ' + e2)
    }
  },
  (app) => {},
)
