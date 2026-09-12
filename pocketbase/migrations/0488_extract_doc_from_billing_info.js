/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 0488: Extrair todos os campos do array additional_info e billing_info de /orders/2000018410071220/billing_info
    const ord = app.findFirstRecordByFilter('ml_orders', "order_id = '2000018410071220'")
    if (!ord) return
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (!sRecords || sRecords.length === 0) return
    const settings = sRecords[0]
    const accessToken = settings.getString('access_token')

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
      const bInfo = (res.json && res.json.billing_info) || {}
      const addInfo = bInfo.additional_info || []
      const map = {}
      for (let i = 0; i < addInfo.length; i++) {
        map[addInfo[i].type] = addInfo[i].value
      }
      ord.set(
        'status_detail',
        'DOC_NUMBER: ' +
          (bInfo.doc_number || map['DOC_NUMBER'] || 'N/A') +
          ' | DOC_TYPE: ' +
          (bInfo.doc_type || map['DOC_TYPE'] || 'N/A') +
          ' | MAP: ' +
          JSON.stringify(map),
      )
      app.save(ord)
    } catch (e) {
      ord.set('status_detail', 'ERR: ' + e)
      app.save(ord)
    }
  },
  (app) => {},
)
