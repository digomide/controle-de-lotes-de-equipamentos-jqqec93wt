/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 0487: Chamar /orders/2000018410071220/billing_info diretamente e salvar campos limpos
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (!sRecords || sRecords.length === 0) return
    const settings = sRecords[0]
    const accessToken = settings.getString('access_token')
    if (!accessToken) return

    const ord = app.findFirstRecordByFilter('ml_orders', "order_id = '2000018410071220'")
    if (!ord) return

    try {
      const res = $http.send({
        url: 'https://api.mercadolibre.com/orders/2000018410071220/billing_info',
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + accessToken,
          Accept: 'application/json',
        },
        timeout: 10,
      })

      const resJson = res.json || {}
      // Exemplo: resJson.billing_info.doc_number ou additional_info
      ord.set(
        'status_detail',
        JSON.stringify({
          status: res.statusCode,
          billing_info: resJson.billing_info,
        }),
      )
      app.save(ord)
    } catch (e) {
      ord.set('status_detail', 'ERR: ' + e)
      app.save(ord)
    }
  },
  (app) => {},
)
