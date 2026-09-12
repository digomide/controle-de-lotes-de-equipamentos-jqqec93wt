/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 0480: Migração definitiva para enriquecer todos os pedidos com shipping_handling_limit, shipping_date_shipped, shipping_date_delivered e shipping_delayed
    // Restaura status_detail do pedido de teste para vazio

    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (!sRecords || sRecords.length === 0) return
    const settings = sRecords[0]
    let accessToken = settings.getString('access_token')
    const refreshToken = settings.getString('refresh_token')
    const clientId = settings.getString('client_id')
    const clientSecret = settings.getString('client_secret')
    const tokenExpiresAt = settings.getString('token_expires_at')

    // Limpar status_detail usado para inspeção
    try {
      const o1 = app.findRecordById('ml_orders', 't9dtytx3o33xqhm')
      if (o1) {
        o1.set('status_detail', '')
        app.save(o1)
      }
      const o2 = app.findRecordById('ml_orders', 'v92xa3wcs5iv0o0')
      if (o2) {
        o2.set('status_detail', '')
        app.save(o2)
      }
    } catch (_) {}

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
          }
        }
      } catch (rErr) {
        console.log('[0480] Erro ao renovar token: ' + rErr)
      }
    }

    if (!accessToken) return

    // Buscar todos os pedidos com shipping_id
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
          console.log('[0480] Erro ao consultar shipment ' + shippingId + ': ' + netErr)
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
          // A API do ML pode retornar estimated_handling_limit.date no root, ou dentro de shipping_option,
          // ou buffering.date, ou podemos derivar do SLA da agência (próximo dia útil às 16:00 se criado após horário de corte)
          let handlingLimitDate = ''
          if (
            fetchedShipData.estimated_handling_limit &&
            fetchedShipData.estimated_handling_limit.date
          ) {
            handlingLimitDate = fetchedShipData.estimated_handling_limit.date
          } else if (
            fetchedShipData.shipping_option &&
            fetchedShipData.shipping_option.estimated_handling_limit &&
            fetchedShipData.shipping_option.estimated_handling_limit.date
          ) {
            handlingLimitDate = fetchedShipData.shipping_option.estimated_handling_limit.date
          } else if (
            fetchedShipData.shipping_option &&
            fetchedShipData.shipping_option.buffering &&
            fetchedShipData.shipping_option.buffering.date
          ) {
            handlingLimitDate = fetchedShipData.shipping_option.buffering.date
          } else if (fetchedShipData.handling_limit) {
            handlingLimitDate = fetchedShipData.handling_limit
          }

          // Se a API não retornou estimated_handling_limit explícito, calcular com base no SLA padrão Mercado Envios:
          // A etiqueta do ML estabelece o horário limite de despacho às 16:00 (America/Sao_Paulo).
          // Se a venda ocorreu antes das 13:00 (corte), o despacho é no mesmo dia útil às 16:00 BRT (19:00 UTC).
          // Se ocorreu após as 13:00, o despacho é no próximo dia útil às 16:00 BRT (19:00 UTC).
          if (!handlingLimitDate) {
            const dateCreatedStr = o.getString('date_created') || fetchedShipData.date_created
            if (dateCreatedStr) {
              const dt = new Date(dateCreatedStr)
              // Em São Paulo (UTC-3), determinar dia útil
              // 13:00 BRT = 16:00 UTC
              const createdHourUTC = dt.getUTCHours()
              let targetDate = new Date(dt.getTime())

              // Se venda foi após 16:00 UTC (13h BRT), despachar no dia seguinte útil
              if (createdHourUTC >= 16) {
                targetDate.setUTCDate(targetDate.getUTCDate() + 1)
              }

              // Pular fim de semana (sábado 6 -> segunda, domingo 0 -> segunda)
              while (targetDate.getUTCDay() === 0 || targetDate.getUTCDay() === 6) {
                targetDate.setUTCDate(targetDate.getUTCDate() + 1)
              }

              // Definir 16:00 Horário de Brasília (19:00 UTC)
              targetDate.setUTCHours(19, 0, 0, 0)
              handlingLimitDate = targetDate.toISOString()
            }
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

          // A. De status_history do shipment (formato { date_shipped: "...", date_delivered: "..." })
          if (fetchedShipData.status_history) {
            const sh = fetchedShipData.status_history
            if (sh.date_shipped) {
              dateShipped = sh.date_shipped
            }
            if (sh.date_delivered) {
              dateDelivered = sh.date_delivered
            }
          }

          // B. De campos diretos
          if (!dateShipped && fetchedShipData.date_shipped) {
            dateShipped = fetchedShipData.date_shipped
          }
          if (!dateDelivered && fetchedShipData.date_delivered) {
            dateDelivered = fetchedShipData.date_delivered
          }

          // C. De substatus_history se tiver evento de transição para shipped
          if (!dateShipped && Array.isArray(fetchedShipData.substatus_history)) {
            for (let subIdx = 0; subIdx < fetchedShipData.substatus_history.length; subIdx++) {
              const ssh = fetchedShipData.substatus_history[subIdx]
              if (!ssh) continue
              if (ssh.status === 'shipped' && ssh.date) {
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
          // Critérios do ML:
          // - Se já foi bipado (dateShipped): se dateShipped > handlingLimitDate -> atrasado!
          // - Se NÃO foi bipado ainda e status é ready_to_ship/pending: se agora > handlingLimitDate -> atrasado!
          // - Se substatus tiver delayed / delay
          let isDelayed = false
          const shipSub = (
            fetchedShipData.substatus ||
            o.getString('shipping_substatus') ||
            ''
          ).toLowerCase()
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
                '[0480] Erro ao salvar pedido ' + o.getString('order_id') + ': ' + saveErr,
              )
            }
          }
        }
      }

      console.log(
        '[0480] Backfill concluído: ' +
          updatedCount +
          ' pedidos enriquecidos com handling_limit, bip e delay.',
      )
    } catch (errOrders) {
      console.log('[0480] Erro ao iterar pedidos: ' + errOrders)
    }
  },
  (app) => {},
)
