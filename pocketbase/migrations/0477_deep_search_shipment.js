/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 0477: Inspecionar substatus_history completo e carrier_info e snapshot_packing
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (!sRecords || sRecords.length === 0) return
    const settings = sRecords[0]
    const accessToken = settings.getString('access_token')
    if (!accessToken) return

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
      if (res.statusCode === 200 && res.json) {
        const order = app.findRecordById('ml_orders', 't9dtytx3o33xqhm')
        const j = res.json
        // Buscar se há estimated_handling_limit ou similar em shipping_option ou em qualquer propriedade aninhada
        let foundKeys = []
        function findKeys(obj, prefix) {
          if (!obj || typeof obj !== 'object') return
          const kList = Object.keys(obj)
          for (let i = 0; i < kList.length; i++) {
            const k = kList[i]
            const path = prefix ? prefix + '.' + k : k
            if (
              k.toLowerCase().includes('limit') ||
              k.toLowerCase().includes('handl') ||
              k.toLowerCase().includes('bip') ||
              k.toLowerCase().includes('sla')
            ) {
              foundKeys.push(path + ' = ' + JSON.stringify(obj[k]))
            }
            if (typeof obj[k] === 'object' && obj[k] !== null && prefix.split('.').length < 3) {
              findKeys(obj[k], path)
            }
          }
        }
        findKeys(j, '')

        order.set(
          'status_detail',
          'FOUND: ' + foundKeys.join(' | ') + ' || SO_ALL: ' + JSON.stringify(j.shipping_option),
        )
        app.save(order)
      }
    } catch (_) {}
  },
  (app) => {},
)
