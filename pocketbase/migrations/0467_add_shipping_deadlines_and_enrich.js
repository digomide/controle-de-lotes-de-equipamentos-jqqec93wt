/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 0467: Adiciona campos de envio e prazos na coleção ml_orders e backfill retroativo via API /shipments/:id
    // Novos campos:
    // - shipping_handling_limit (date)
    // - shipping_date_shipped (date)
    // - shipping_date_delivered (date)
    // - shipping_delayed (bool)

    const ordersCol = app.findCollectionByNameOrId('ml_orders')
    if (ordersCol) {
      let fieldsChanged = false

      if (!ordersCol.fields.getByName('shipping_handling_limit')) {
        ordersCol.fields.add(
          new DateField({
            name: 'shipping_handling_limit',
            required: false,
          }),
        )
        fieldsChanged = true
      }

      if (!ordersCol.fields.getByName('shipping_date_shipped')) {
        ordersCol.fields.add(
          new DateField({
            name: 'shipping_date_shipped',
            required: false,
          }),
        )
        fieldsChanged = true
      }

      if (!ordersCol.fields.getByName('shipping_date_delivered')) {
        ordersCol.fields.add(
          new DateField({
            name: 'shipping_date_delivered',
            required: false,
          }),
        )
        fieldsChanged = true
      }

      if (!ordersCol.fields.getByName('shipping_delayed')) {
        ordersCol.fields.add(
          new BoolField({
            name: 'shipping_delayed',
            required: false,
          }),
        )
        fieldsChanged = true
      }

      if (fieldsChanged) {
        app.save(ordersCol)
        console.log('[0467] Campos de shipping adicionados à coleção ml_orders.')
      }
    }

    // Agora buscar credenciais do Mercado Livre para consulta e enriquecimento retroativo
    let settings = null
    try {
      const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
      if (sRecords && sRecords.length > 0) {
        settings = sRecords[0]
      }
    } catch (e) {
      console.log('[0467] Erro ao buscar ml_settings: ' + e)
    }

    if (!settings) {
      console.log('[0467] ml_settings não encontrado, encerrando migração.')
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
            console.log('[0467] Token atualizado com sucesso.')
          }
        }
      } catch (rErr) {
        console.log('[0467] Erro ao renovar token: ' + rErr)
      }
    }

    if (!accessToken) {
      console.log('[0467] Sem accessToken, enriquecimento não executado.')
      return
    }

    // Iterar pedidos com shipping_id
    try {
      const orders = app.findRecordsByFilter(
        'ml_orders',
        "shipping_id != ''",
        '-date_created',
        250,
        0,
      )

      let updatedCount = 0

      for (let i = 0; i < orders.length; i++) {
        const o = orders[i]
        const shippingId = o.getString('shipping_id')
        if (!shippingId) continue

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
          console.log('[0467] Erro ao consultar shipment ' + shippingId + ': ' + netErr)
        }

        if (fetchedShipData) {
          let hasChange = false

          // 1. Status e Substatus
          if (
            fetchedShipData.status &&
            String(fetchedShipData.status) !== o.getString('shipping_status')
          ) {
            o.set('shipping_status', String(fetchedShipData.status))
            hasChange = true
          }
          if (
            fetchedShipData.substatus &&
            String(fetchedShipData.substatus) !== o.getString('shipping_substatus')
          ) {
            o.set('shipping_substatus', String(fetchedShipData.substatus))
            hasChange = true
          }

          // 2. Extrair handling limit
          let handlingLimitDate = ''
          if (
            fetchedShipData.estimated_handling_limit &&
            fetchedShipData.estimated_handling_limit.date
          ) {
            handlingLimitDate = fetchedShipData.estimated_handling_limit.date
          } else if (fetchedShipData.handling_limit) {
            handlingLimitDate = fetchedShipData.handling_limit
          }

          if (handlingLimitDate) {
            const isoHandlingLimit = new Date(handlingLimitDate).toISOString()
            if (o.getString('shipping_handling_limit') !== isoHandlingLimit) {
              o.set('shipping_handling_limit', isoHandlingLimit)
              hasChange = true
            }
          }

          // 3. Extrair date_shipped (bip) e date_delivered
          let dateShipped = ''
          let dateDelivered = ''

          // A. De status_history se existir
          if (Array.isArray(fetchedShipData.status_history)) {
            for (let sIdx = 0; sIdx < fetchedShipData.status_history.length; sIdx++) {
              const sh = fetchedShipData.status_history[sIdx]
              if (!sh) continue
              if (sh.status === 'shipped' && sh.date) {
                dateShipped = sh.date
              }
              if (sh.status === 'delivered' && sh.date) {
                dateDelivered = sh.date
              }
            }
          }

          // B. De campos diretos do shipment
          if (!dateShipped && fetchedShipData.date_shipped) {
            dateShipped = fetchedShipData.date_shipped
          }
          if (!dateDelivered && fetchedShipData.date_delivered) {
            dateDelivered = fetchedShipData.date_delivered
          }

          // C. De shipping_option ou lead_time / substatus_history
          if (Array.isArray(fetchedShipData.substatus_history)) {
            for (let subIdx = 0; subIdx < fetchedShipData.substatus_history.length; subIdx++) {
              const ssh = fetchedShipData.substatus_history[subIdx]
              if (!ssh) continue
              if (ssh.status === 'shipped' && ssh.date && !dateShipped) {
                dateShipped = ssh.date
              }
            }
          }

          if (dateShipped) {
            const isoShipped = new Date(dateShipped).toISOString()
            if (o.getString('shipping_date_shipped') !== isoShipped) {
              o.set('shipping_date_shipped', isoShipped)
              hasChange = true
            }
          }

          if (dateDelivered) {
            const isoDelivered = new Date(dateDelivered).toISOString()
            if (o.getString('shipping_date_delivered') !== isoDelivered) {
              o.set('shipping_date_delivered', isoDelivered)
              hasChange = true
            }
          }

          // 4. Calcular shipping_delayed (bool)
          // Critérios:
          // - Se já foi bipado (dateShipped): se dateShipped > handlingLimitDate -> atrasado!
          // - Se NÃO foi bipado ainda: se agora > handlingLimitDate -> atrasado!
          // - Se substatus tiver delayed / delay / handling_delayed
          // - Se tags ou status_history do shipment indicarem delay
          let isDelayed = false
          const shipSub = (fetchedShipData.substatus || '').toLowerCase()
          if (
            shipSub.includes('delayed') ||
            shipSub.includes('delay') ||
            shipSub.includes('handling_delayed')
          ) {
            isDelayed = true
          }

          const limitMs = handlingLimitDate ? new Date(handlingLimitDate).getTime() : 0

          if (limitMs > 0) {
            if (dateShipped) {
              const shippedMs = new Date(dateShipped).getTime()
              if (shippedMs > limitMs) {
                isDelayed = true
              }
            } else {
              // Ainda não bipado
              const currentStatus = String(fetchedShipData.status || o.getString('shipping_status'))
              if (
                currentStatus !== 'shipped' &&
                currentStatus !== 'delivered' &&
                currentStatus !== 'cancelled'
              ) {
                if (Date.now() > limitMs) {
                  isDelayed = true
                }
              }
            }
          }

          if (o.getBool('shipping_delayed') !== isDelayed) {
            o.set('shipping_delayed', isDelayed)
            hasChange = true
          }

          if (hasChange) {
            try {
              app.save(o)
              updatedCount++
            } catch (saveErr) {
              console.log(
                '[0467] Erro ao salvar pedido ' + o.getString('order_id') + ': ' + saveErr,
              )
            }
          }
        }
      }

      console.log(
        '[0467] Migração concluída com sucesso. ' + updatedCount + ' pedidos enriquecidos.',
      )
    } catch (err) {
      console.log('[0467] Erro durante o enriquecimento: ' + err)
    }
  },
  (app) => {
    // Reverter campos
    const ordersCol = app.findCollectionByNameOrId('ml_orders')
    if (ordersCol) {
      ordersCol.fields.removeByName('shipping_handling_limit')
      ordersCol.fields.removeByName('shipping_date_shipped')
      ordersCol.fields.removeByName('shipping_date_delivered')
      ordersCol.fields.removeByName('shipping_delayed')
      app.save(ordersCol)
    }
  },
)
