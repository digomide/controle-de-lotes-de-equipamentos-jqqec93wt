/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 0490: Backfill do cliente Ademilson e enriquecimento inicial a partir de /billing_info
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '', 1, 0)
    if (!sRecords || sRecords.length === 0) return
    const settings = sRecords[0]
    const accessToken = settings.getString('access_token')
    if (!accessToken) return

    // Buscar pedidos sem buyer_document ou com documento vazio ordenando por -date_created
    const orders = app.findRecordsByFilter(
      'ml_orders',
      "buyer_document = '' || buyer_document = null",
      '-date_created',
      50,
      0,
    )

    for (let i = 0; i < orders.length; i++) {
      const ord = orders[i]
      const orderId = ord.getString('order_id')
      if (!orderId) continue

      try {
        const res = $http.send({
          url:
            'https://api.mercadolibre.com/orders/' + encodeURIComponent(orderId) + '/billing_info',
          method: 'GET',
          headers: {
            Authorization: 'Bearer ' + accessToken,
            Accept: 'application/json',
          },
          timeout: 10,
        })

        if (res.statusCode === 200 && res.json && res.json.billing_info) {
          const bInfo = res.json.billing_info
          let doc = bInfo.doc_number || ''
          let fName = ''
          let lName = ''

          const addInfo = bInfo.additional_info || []
          for (let j = 0; j < addInfo.length; j++) {
            const item = addInfo[j]
            if (item.type === 'DOC_NUMBER' && !doc) doc = item.value
            if (item.type === 'FIRST_NAME') fName = item.value
            if (item.type === 'LAST_NAME') lName = item.value
          }

          const fullName = [fName, lName].filter(Boolean).join(' ')
          if (doc) {
            ord.set('buyer_document', doc)
          }
          if (
            fullName &&
            (!ord.getString('buyer_name') ||
              ord.getString('buyer_name') === ord.getString('buyer_nickname'))
          ) {
            ord.set('buyer_name', fullName)
          }
          app.save(ord)

          // Upsert em ml_customers
          const buyerId = ord.getString('buyer_id')
          const buyerNick = ord.getString('buyer_nickname')

          let cust = null
          if (buyerId) {
            try {
              cust = app.findFirstRecordByFilter('ml_customers', "buyer_id = '" + buyerId + "'")
            } catch (_) {}
          }
          if (!cust && buyerNick) {
            try {
              cust = app.findFirstRecordByFilter(
                'ml_customers',
                "nickname = '" + buyerNick.replace(/'/g, "\\'") + "'",
              )
            } catch (_) {}
          }

          if (cust) {
            if (doc && !cust.getString('document')) cust.set('document', doc)
            if (fullName && (!cust.getString('name') || cust.getString('name') === buyerNick)) {
              cust.set('name', fullName)
            }
            app.save(cust)
          }
        }
      } catch (err) {
        console.log('[0490] Erro ao buscar billing_info de ' + orderId + ': ' + err)
      }
    }
  },
  (app) => {},
)
