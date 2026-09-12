/// <reference path="../pb_data/types.d.ts" />

/**
 * Hook de busca automática de dados fiscais (CPF/CNPJ, nome, endereço) na API do Mercado Livre
 * Rota POST: /backend/v1/ml/orders/:order_id/fiscal-lookup
 *
 * Busca dados em cascata:
 * 1. ml_customers local existente (se já tiver CPF/CNPJ cadastrado para o comprador)
 * 2. API oficial do Mercado Livre: GET /orders/:order_id/billing_info
 * 3. API oficial de envios: GET /shipments/:shipping_id/billing_info
 * 4. API de detalhes do pedido: GET /orders/:order_id
 * 5. Se encontrar dados, atualiza automaticamente em ml_orders E faz upsert em ml_customers
 */

routerAdd(
  'POST',
  '/backend/v1/ml/orders/{order_id}/fiscal-lookup',
  (e) => {
    var authRecord = e.auth
    if (!authRecord) {
      try {
        var info = e.requestInfo()
        authRecord = info.auth
      } catch (_) {}
    }

    if (!authRecord || !authRecord.id) {
      return e.json(401, {
        ok: false,
        error: 'Acesso não autorizado: sessão expirada ou não autenticada.',
      })
    }

    var orderId = e.request.pathValue('order_id')
    if (!orderId) {
      return e.json(400, { ok: false, error: 'ID do pedido é obrigatório.' })
    }

    // 1. Carregar pedido local
    var orderRecord = null
    try {
      orderRecord = $app.findFirstRecordByFilter('ml_orders', "order_id = '" + orderId + "'")
    } catch (_) {}

    if (!orderRecord) {
      return e.json(404, { ok: false, error: 'Pedido ML não encontrado no banco de dados local.' })
    }

    var buyerId = orderRecord.getString('buyer_id')
    var buyerNick = orderRecord.getString('buyer_nickname')
    var shippingId = orderRecord.getString('shipping_id')
    var currentDoc = orderRecord.getString('buyer_document') || ''
    var currentName = orderRecord.getString('buyer_name') || ''

    // 2. Verificar se já temos o documento em ml_customers
    var existingCustomer = null
    if (buyerId) {
      try {
        existingCustomer = $app.findFirstRecordByFilter(
          'ml_customers',
          "buyer_id = '" + buyerId + "'",
        )
      } catch (_) {}
    }
    if (!existingCustomer && buyerNick) {
      try {
        existingCustomer = $app.findFirstRecordByFilter(
          'ml_customers',
          "nickname = '" + buyerNick.replace(/'/g, "\\'") + "'",
        )
      } catch (_) {}
    }

    var foundDoc = currentDoc
    var foundName = currentName
    var foundSource = currentDoc ? 'local_order' : ''

    if (!foundDoc && existingCustomer && existingCustomer.getString('document')) {
      foundDoc = existingCustomer.getString('document').trim()
      foundSource = 'ml_customers'
      if (!foundName || foundName === buyerNick) {
        foundName = existingCustomer.getString('name') || foundName
      }
    }

    // 3. Se ainda não tiver documento, buscar na API do Mercado Livre
    if (!foundDoc) {
      // Carregar ml_settings
      var sRecords = []
      try {
        sRecords = $app.findRecordsByFilter('ml_settings', '1=1', '', 1, 0)
      } catch (_) {}

      if (sRecords && sRecords.length > 0) {
        var settings = sRecords[0]
        var accessToken = settings.getString('access_token')
        var refreshToken = settings.getString('refresh_token')
        var clientId = settings.getString('client_id')
        var clientSecret = settings.getString('client_secret')
        var tokenExpiresAt = settings.getString('token_expires_at')

        // Renovar token se necessário
        var needRefresh = false
        if (tokenExpiresAt) {
          try {
            var expTime = new Date(tokenExpiresAt).getTime()
            if (Date.now() + 5 * 60 * 1000 >= expTime) needRefresh = true
          } catch (_) {}
        }

        if (needRefresh && refreshToken && clientId && clientSecret) {
          try {
            var refRes = $http.send({
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
              if (refRes.json.refresh_token)
                settings.set('refresh_token', refRes.json.refresh_token)
              $app.save(settings)
            }
          } catch (rErr) {
            console.log('[fiscal_lookup] Erro ao renovar token: ' + rErr)
          }
        }

        // Tentativa A: /orders/:order_id/billing_info
        if (accessToken) {
          try {
            var obRes = $http.send({
              url:
                'https://api.mercadolibre.com/orders/' +
                encodeURIComponent(orderId) +
                '/billing_info',
              method: 'GET',
              headers: {
                Authorization: 'Bearer ' + accessToken,
                Accept: 'application/json',
              },
              timeout: 12,
            })

            if (obRes.statusCode === 200 && obRes.json && obRes.json.billing_info) {
              var bInfo = obRes.json.billing_info
              if (bInfo.doc_number) {
                foundDoc = String(bInfo.doc_number).trim()
                foundSource = 'ml_api_order_billing_info'
              }
              var addList = bInfo.additional_info || []
              var fName = ''
              var lName = ''
              for (var i = 0; i < addList.length; i++) {
                var it = addList[i]
                if (it.type === 'DOC_NUMBER' && !foundDoc) {
                  foundDoc = String(it.value).trim()
                  foundSource = 'ml_api_order_billing_info'
                }
                if (it.type === 'FIRST_NAME') fName = String(it.value).trim()
                if (it.type === 'LAST_NAME') lName = String(it.value).trim()
              }
              var full = [fName, lName].filter(Boolean).join(' ')
              if (full && (!foundName || foundName === buyerNick)) {
                foundName = full
              }
            }
          } catch (obErr) {
            console.log('[fiscal_lookup] Erro em order billing_info: ' + obErr)
          }

          // Tentativa B: /shipments/:shipping_id/billing_info se ainda não encontrou
          if (!foundDoc && shippingId) {
            try {
              var sbRes = $http.send({
                url:
                  'https://api.mercadolibre.com/shipments/' +
                  encodeURIComponent(shippingId) +
                  '/billing_info',
                method: 'GET',
                headers: {
                  Authorization: 'Bearer ' + accessToken,
                  Accept: 'application/json',
                },
                timeout: 12,
              })

              if (sbRes.statusCode === 200 && sbRes.json && sbRes.json.billing_info) {
                var sbInfo = sbRes.json.billing_info
                if (sbInfo.doc_number) {
                  foundDoc = String(sbInfo.doc_number).trim()
                  foundSource = 'ml_api_shipment_billing_info'
                }
                var sAddList = sbInfo.additional_info || []
                for (var si = 0; si < sAddList.length; si++) {
                  if (sAddList[si].type === 'DOC_NUMBER' && !foundDoc) {
                    foundDoc = String(sAddList[si].value).trim()
                    foundSource = 'ml_api_shipment_billing_info'
                  }
                }
              }
            } catch (sbErr) {
              console.log('[fiscal_lookup] Erro em shipment billing_info: ' + sbErr)
            }
          }

          // Tentativa C: /orders/:order_id
          if (!foundDoc) {
            try {
              var oRes = $http.send({
                url: 'https://api.mercadolibre.com/orders/' + encodeURIComponent(orderId),
                method: 'GET',
                headers: {
                  Authorization: 'Bearer ' + accessToken,
                  Accept: 'application/json',
                },
                timeout: 12,
              })

              if (oRes.statusCode === 200 && oRes.json) {
                var bObj = oRes.json.buyer || {}
                if (bObj.billing_info && bObj.billing_info.doc_number) {
                  foundDoc = String(bObj.billing_info.doc_number).trim()
                  foundSource = 'ml_api_order_root'
                }
                var rawName = [bObj.first_name, bObj.last_name].filter(Boolean).join(' ')
                if (rawName && (!foundName || foundName === buyerNick)) {
                  foundName = rawName
                }
              }
            } catch (oErr) {
              console.log('[fiscal_lookup] Erro em order root: ' + oErr)
            }
          }
        }
      }
    }

    // 4. Se encontrou ou atualizou documento/nome, salvar no pedido e em ml_customers
    var updated = false
    if (foundDoc && foundDoc !== currentDoc) {
      orderRecord.set('buyer_document', foundDoc)
      updated = true
    }
    if (foundName && foundName !== currentName && foundName !== buyerNick) {
      orderRecord.set('buyer_name', foundName)
      updated = true
    }
    if (updated) {
      $app.save(orderRecord)
    }

    // Upsert no cadastro ml_customers
    if (foundDoc || foundName) {
      try {
        var custCol = $app.findCollectionByNameOrId('ml_customers')
        var targetCust = existingCustomer || new Record(custCol)

        if (!existingCustomer) {
          targetCust.set('buyer_id', buyerId)
          targetCust.set('nickname', buyerNick)
          targetCust.set('name', foundName || buyerNick || 'Cliente ML')
          if (foundDoc) targetCust.set('document', foundDoc)
          targetCust.set('origin', 'ml')
          targetCust.set('tags', ['ml'])
          $app.save(targetCust)
        } else {
          var custChanged = false
          if (foundDoc && !targetCust.getString('document')) {
            targetCust.set('document', foundDoc)
            custChanged = true
          }
          if (
            foundName &&
            (!targetCust.getString('name') || targetCust.getString('name') === buyerNick)
          ) {
            targetCust.set('name', foundName)
            custChanged = true
          }
          if (custChanged) {
            $app.save(targetCust)
          }
        }
      } catch (cErr) {
        console.log('[fiscal_lookup] Erro ao sincronizar ml_customers: ' + cErr)
      }
    }

    return e.json(200, {
      ok: true,
      found: Boolean(foundDoc),
      order_id: orderId,
      document: foundDoc || '',
      buyer_name: foundName || '',
      source: foundSource || 'not_found',
      message: foundDoc
        ? 'Dados fiscais localizados com sucesso via ' + foundSource + '!'
        : 'A API do Mercado Livre não retornou o CPF/CNPJ para este pedido (proteção de privacidade/LGPD). Utilize o botão de edição rápida ou consulte a etiqueta de envio.',
    })
  },
  $apis.requireAuth(),
)
