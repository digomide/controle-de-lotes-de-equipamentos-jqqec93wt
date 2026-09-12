/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 0485: Testar busca de dados fiscais/documento do pedido 2000018410071220 e shipping 47992043858
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (!sRecords || sRecords.length === 0) return
    const settings = sRecords[0]
    let accessToken = settings.getString('access_token')
    const refreshToken = settings.getString('refresh_token')
    const clientId = settings.getString('client_id')
    const clientSecret = settings.getString('client_secret')

    // Tentar renovar se necessário
    try {
      const refRes = $http.send({
        url: 'https://api.mercadolibre.com/oauth/token',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
        }),
        timeout: 15,
      })
      if (refRes.statusCode === 200 && refRes.json && refRes.json.access_token) {
        accessToken = refRes.json.access_token
        settings.set('access_token', accessToken)
        if (refRes.json.refresh_token) settings.set('refresh_token', refRes.json.refresh_token)
        app.save(settings)
      }
    } catch (_) {}

    const orderId = '2000018410071220'
    const shippingId = '47992043858'
    const endpointsToTest = [
      'https://api.mercadolibre.com/orders/' + orderId + '/billing_info',
      'https://api.mercadolibre.com/shipments/' + shippingId + '/billing_info',
      'https://api.mercadolibre.com/shipments/' + shippingId,
      'https://api.mercadolibre.com/orders/' + orderId,
    ]

    const probeResults = {}

    for (let i = 0; i < endpointsToTest.length; i++) {
      const url = endpointsToTest[i]
      try {
        const res = $http.send({
          url: url,
          method: 'GET',
          headers: {
            Authorization: 'Bearer ' + accessToken,
            Accept: 'application/json',
          },
          timeout: 10,
        })
        probeResults[url] = {
          status: res.statusCode,
          body: res.json,
        }
      } catch (err) {
        probeResults[url] = { err: String(err) }
      }
    }

    // Salvar no order status_detail para podermos inspecionar via db_query
    try {
      const ord = app.findFirstRecordByFilter('ml_orders', "order_id = '" + orderId + "'")
      if (ord) {
        ord.set('status_detail', JSON.stringify(probeResults).slice(0, 4000))
        app.save(ord)
      }
    } catch (e) {
      console.log('[0485] erro ao salvar status_detail: ' + e)
    }
  },
  (app) => {},
)
