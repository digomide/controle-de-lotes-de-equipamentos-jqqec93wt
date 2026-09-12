/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 0469: Inspecionar e salvar resposta do shipment em um pedido para ver exatamente os campos
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (!sRecords || sRecords.length === 0) return
    const settings = sRecords[0]
    const accessToken = settings.getString('access_token')
    if (!accessToken) return

    // Consultar envio de OLIVEIRAGABRIEL 47982466891
    let data1 = null
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
        data1 = res.json
      }
    } catch (_) {}

    // Salvar no pedido de OLIVEIRAGABRIEL (id t9dtytx3o33xqhm) em status_detail para vermos via db_query
    if (data1) {
      try {
        const order = app.findRecordById('ml_orders', 't9dtytx3o33xqhm')
        const dump = {
          status: data1.status,
          substatus: data1.substatus,
          handling_limit: data1.estimated_handling_limit,
          status_history: data1.status_history,
          substatus_history: data1.substatus_history,
          lead_time: data1.lead_time,
          date_shipped: data1.date_shipped,
          date_delivered: data1.date_delivered,
          date_created: data1.date_created,
          date_first_printed: data1.date_first_printed,
          tags: data1.tags,
          delay: data1.delay,
        }
        order.set('status_detail', JSON.stringify(dump))
        app.save(order)
      } catch (errO) {}
    }

    // Consultar BARBOLUCAS 47977020575
    let data2 = null
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
      if (res2.statusCode === 200 && res2.json) {
        data2 = res2.json
      }
    } catch (_) {}

    if (data2) {
      try {
        const order2 = app.findRecordById('ml_orders', 'v92xa3wcs5iv0o0')
        const dump2 = {
          status: data2.status,
          substatus: data2.substatus,
          handling_limit: data2.estimated_handling_limit,
          status_history: data2.status_history,
          substatus_history: data2.substatus_history,
          lead_time: data2.lead_time,
          date_shipped: data2.date_shipped,
          date_delivered: data2.date_delivered,
          date_created: data2.date_created,
          tags: data2.tags,
          delay: data2.delay,
        }
        order2.set('status_detail', JSON.stringify(dump2))
        app.save(order2)
      } catch (errO2) {}
    }
  },
  (app) => {},
)
