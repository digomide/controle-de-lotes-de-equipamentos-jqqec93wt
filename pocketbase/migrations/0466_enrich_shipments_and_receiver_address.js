/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 0466: Sincronização e enriquecimento imediato de receiver_address e shipping_status
    // Consulta a API de shipments para pedidos que possuem shipping_id e estão sem receiver_address
    // ou que precisam ter o status de envio atualizado de forma definitiva.

    let settings = null
    try {
      const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
      if (sRecords && sRecords.length > 0) {
        settings = sRecords[0]
      }
    } catch (e) {
      console.log('[0466] Aviso ao buscar ml_settings: ' + e)
    }

    if (!settings) {
      console.log('[0466] ml_settings não encontrado, encerrando migração.')
      return
    }

    let accessToken = settings.getString('access_token')
    const refreshToken = settings.getString('refresh_token')
    const clientId = settings.getString('client_id')
    const clientSecret = settings.getString('client_secret')
    const tokenExpiresAt = settings.getString('token_expires_at')

    // Renovar token se necessário
    if (tokenExpiresAt) {
      try {
        const expTime = new Date(tokenExpiresAt).getTime()
        if (Date.now() + 5 * 60 * 1000 >= expTime && refreshToken && clientId && clientSecret) {
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
            timeout: 20,
          })
          if (refRes.statusCode === 200 && refRes.json) {
            accessToken = refRes.json.access_token || accessToken
            settings.set('access_token', accessToken)
            if (refRes.json.refresh_token) {
              settings.set('refresh_token', refRes.json.refresh_token)
            }
            app.save(settings)
            console.log('[0466] Token atualizado com sucesso.')
          }
        }
      } catch (rErr) {
        console.log('[0466] Erro ao renovar token: ' + rErr)
      }
    }

    if (!accessToken) {
      console.log('[0466] Sem accessToken, migração encerrada.')
      return
    }

    let customersCol = null
    try {
      customersCol = app.findCollectionByNameOrId('ml_customers')
    } catch (_) {}

    // Buscar pedidos com shipping_id
    try {
      const orders = app.findRecordsByFilter(
        'ml_orders',
        "shipping_id != ''",
        '-date_created',
        250,
        0,
      )

      let updatedCount = 0
      let customersUpdatedCount = 0

      for (let i = 0; i < orders.length; i++) {
        const o = orders[i]
        const shippingId = o.getString('shipping_id')
        if (!shippingId) continue

        let receiverAddress = o.get('receiver_address')
        let shippingStatus = o.getString('shipping_status')
        let shippingSubstatus = o.getString('shipping_substatus')
        let shippingMode = o.getString('shipping_mode')

        let fetchedShipData = null

        try {
          const res = $http.send({
            url: 'https://api.mercadolibre.com/shipments/' + encodeURIComponent(shippingId),
            method: 'GET',
            headers: {
              Authorization: 'Bearer ' + accessToken,
              Accept: 'application/json',
            },
            timeout: 10,
          })

          if (res.statusCode === 200 && res.json) {
            fetchedShipData = res.json
          }
        } catch (netErr) {
          console.log('[0466] Erro ao consultar shipment ' + shippingId + ': ' + netErr)
        }

        if (fetchedShipData) {
          let hasChange = false

          if (fetchedShipData.status && String(fetchedShipData.status) !== shippingStatus) {
            shippingStatus = String(fetchedShipData.status)
            o.set('shipping_status', shippingStatus)
            hasChange = true
          }
          if (
            fetchedShipData.substatus &&
            String(fetchedShipData.substatus) !== shippingSubstatus
          ) {
            shippingSubstatus = String(fetchedShipData.substatus)
            o.set('shipping_substatus', shippingSubstatus)
            hasChange = true
          }
          if (
            (fetchedShipData.mode || fetchedShipData.shipping_mode) &&
            String(fetchedShipData.mode || fetchedShipData.shipping_mode) !== shippingMode
          ) {
            shippingMode = String(fetchedShipData.mode || fetchedShipData.shipping_mode)
            o.set('shipping_mode', shippingMode)
            hasChange = true
          }
          if (fetchedShipData.receiver_address) {
            receiverAddress = fetchedShipData.receiver_address
            o.set('receiver_address', receiverAddress)
            hasChange = true
          }

          if (hasChange) {
            try {
              app.save(o)
              updatedCount++
            } catch (saveErr) {
              console.log(
                '[0466] Erro ao salvar pedido ' + o.getString('order_id') + ': ' + saveErr,
              )
            }
          }

          // Propagar para o cliente em ml_customers
          if (customersCol && receiverAddress) {
            const buyerId = o.getString('buyer_id')
            const buyerNick = o.getString('buyer_nickname')
            const buyerName = o.getString('buyer_name')
            const buyerDoc = o.getString('buyer_document')

            if (buyerId || buyerNick) {
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

              const parts = [
                receiverAddress.street_name
                  ? receiverAddress.street_name +
                    (receiverAddress.street_number ? ', ' + receiverAddress.street_number : '')
                  : '',
                receiverAddress.comment || receiverAddress.address_line || '',
                (receiverAddress.city && receiverAddress.city.name) || '',
                (receiverAddress.state && receiverAddress.state.name) || '',
                receiverAddress.zip_code ? 'CEP ' + receiverAddress.zip_code : '',
              ].filter(Boolean)
              const formattedAddress = parts.join(' - ')

              if (cust) {
                let custChanged = false
                if (formattedAddress && !cust.getString('address')) {
                  cust.set('address', formattedAddress)
                  custChanged = true
                }
                if (!cust.get('raw_address')) {
                  cust.set('raw_address', receiverAddress)
                  custChanged = true
                }
                if (buyerName && !cust.getString('name')) {
                  cust.set('name', buyerName)
                  custChanged = true
                }
                if (buyerDoc && !cust.getString('document')) {
                  cust.set('document', buyerDoc)
                  custChanged = true
                }
                if (custChanged) {
                  try {
                    app.save(cust)
                    customersUpdatedCount++
                  } catch (_) {}
                }
              } else {
                // Criar cliente novo com dados completos
                try {
                  const newCust = new Record(customersCol)
                  newCust.set('buyer_id', buyerId)
                  newCust.set('nickname', buyerNick)
                  newCust.set('name', buyerName || buyerNick || 'Cliente ML ' + (buyerId || ''))
                  if (buyerDoc) newCust.set('document', buyerDoc)
                  if (formattedAddress) newCust.set('address', formattedAddress)
                  newCust.set('raw_address', receiverAddress)
                  newCust.set('origin', 'ml')
                  newCust.set('tags', ['ml'])
                  app.save(newCust)
                  customersUpdatedCount++
                } catch (_) {}
              }
            }
          }
        }
      }

      console.log(
        '[0466] Migração concluída: ' +
          updatedCount +
          ' pedidos atualizados com dados da API shipments; ' +
          customersUpdatedCount +
          ' clientes enriquecidos.',
      )
    } catch (errOrders) {
      console.log('[0466] Erro ao iterar pedidos: ' + errOrders)
    }
  },
  (app) => {},
)
