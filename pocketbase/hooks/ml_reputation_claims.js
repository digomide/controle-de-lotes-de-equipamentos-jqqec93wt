/// <reference path="../pb_data/types.d.ts" />

/**
 * Hook de sincronização e enriquecimento de dados de contestação de reputação e claims do Mercado Livre
 * Rota POST: /backend/v1/ml/reputation-disputes/sync-claims
 *
 * Tenta consultar a API de pós-venda do ML (/v1/claims ou /post-purchase/v1/claims)
 * usando o token da integração existente em ml_settings.
 * Se retornar 403 (escopo restrito do ML / governança PolicyAgent) ou erro de rede,
 * intercepta de forma graciosa sem quebrar a tela, informando status detalhado e seguro.
 */

routerAdd(
  'POST',
  '/backend/v1/ml/reputation-disputes/sync-claims',
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

    // 1. Carregar credenciais em ml_settings
    var sRecords = []
    try {
      sRecords = $app.findRecordsByFilter('ml_settings', '1=1', '', 1, 0)
    } catch (_) {}

    if (!sRecords || sRecords.length === 0) {
      return e.json(200, {
        ok: false,
        api_available: false,
        status_code: 404,
        message: 'Integração com Mercado Livre não configurada em ml_settings.',
      })
    }

    var settings = sRecords[0]
    var accessToken = settings.getString('access_token')
    var refreshToken = settings.getString('refresh_token')
    var clientId = settings.getString('client_id')
    var clientSecret = settings.getString('client_secret')
    var tokenExpiresAt = settings.getString('token_expires_at')

    // Renovar token se próximo do vencimento
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
          if (refRes.json.refresh_token) {
            settings.set('refresh_token', refRes.json.refresh_token)
          }
          $app.save(settings)
        }
      } catch (rErr) {
        console.log('[rep_disputes] Erro ao renovar token: ' + rErr)
      }
    }

    if (!accessToken) {
      return e.json(200, {
        ok: false,
        api_available: false,
        status_code: 401,
        message: 'Token de acesso do Mercado Livre inválido ou não disponível.',
      })
    }

    // 2. Cruzamento automático local primeiro (busca na ml_orders os compradores de todas as disputas)
    var updatedLocalCount = 0
    try {
      var allDisputes = $app.findRecordsByFilter('ml_reputation_disputes', '1=1', '', 500, 0)
      for (var dIdx = 0; dIdx < allDisputes.length; dIdx++) {
        var dRec = allDisputes[dIdx]
        var saleId = dRec.getString('sale_id_ml')
        var currentName = dRec.getString('customer_name')
        var currentPhone = dRec.getString('customer_phone')
        var hasRef = Boolean(dRec.getString('ml_order_ref'))

        if (saleId && (!currentName || !hasRef || !currentPhone)) {
          try {
            var orderMatch = $app.findFirstRecordByFilter(
              'ml_orders',
              "order_id = '" + saleId + "'",
            )
            if (orderMatch) {
              var chg = false
              if (!hasRef) {
                dRec.set('ml_order_ref', orderMatch.id)
                chg = true
              }
              var bName = orderMatch.getString('buyer_name')
              var bNick = orderMatch.getString('buyer_nickname')
              var bDoc = orderMatch.getString('buyer_document')
              if (!currentName && (bName || bNick)) {
                dRec.set('customer_name', bName || bNick)
                chg = true
              }
              if (!dRec.getString('customer_nickname') && bNick) {
                dRec.set('customer_nickname', bNick)
                chg = true
              }

              // Tentar puxar telefone de ml_customers se disponível
              if (!currentPhone && (orderMatch.getString('buyer_id') || bNick)) {
                try {
                  var bId = orderMatch.getString('buyer_id')
                  var cMatch = null
                  if (bId) {
                    cMatch = $app.findFirstRecordByFilter(
                      'ml_customers',
                      "buyer_id = '" + bId + "'",
                    )
                  }
                  if (!cMatch && bNick) {
                    cMatch = $app.findFirstRecordByFilter(
                      'ml_customers',
                      "nickname = '" + bNick.replace(/'/g, "\\'") + "'",
                    )
                  }
                  if (cMatch && cMatch.getString('phone')) {
                    dRec.set('customer_phone', cMatch.getString('phone'))
                    chg = true
                  }
                } catch (_) {}
              }

              if (chg) {
                $app.save(dRec)
                updatedLocalCount++
              }
            }
          } catch (_) {}
        }
      }
    } catch (crossErr) {
      console.log('[rep_disputes] Erro ao cruzar localmente com pedidos: ' + crossErr)
    }

    // 3. Tentar chamar a API de Claims/Reclamações do Mercado Livre
    // Observação: frequentemente bloqueado pelo ML com 403 / PolicyAgent por escopo não concedido para claims
    var apiSuccess = false
    var apiStatusCode = 0
    var claimsFound = 0
    var apiWarning = ''

    try {
      var claimsRes = $http.send({
        url: 'https://api.mercadolibre.com/post-purchase/v1/claims/search?status=opened',
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + accessToken,
          Accept: 'application/json',
        },
        timeout: 10,
      })

      apiStatusCode = claimsRes.statusCode

      if (claimsRes.statusCode === 200 && claimsRes.json) {
        apiSuccess = true
        var rawClaims = claimsRes.json.data || claimsRes.json.results || []
        claimsFound = rawClaims.length

        // Enriquecer registros com os claims retornados
        for (var c = 0; c < rawClaims.length; c++) {
          var claimObj = rawClaims[c]
          var claimOrderId = String(
            claimObj.resource_id || (claimObj.resource && claimObj.resource.id) || '',
          )
          var claimIdStr = String(claimObj.id || '')
          var reasonStr = String(claimObj.reason_id || claimObj.type || '')

          if (claimOrderId) {
            try {
              var matchedDisp = $app.findFirstRecordByFilter(
                'ml_reputation_disputes',
                "sale_id_ml = '" + claimOrderId + "'",
              )
              if (matchedDisp) {
                var dispChanged = false
                if (claimIdStr && !matchedDisp.getString('claim_id')) {
                  matchedDisp.set('claim_id', claimIdStr)
                  dispChanged = true
                }
                if (reasonStr && !matchedDisp.getString('claim_reason')) {
                  matchedDisp.set('claim_reason', reasonStr)
                  dispChanged = true
                }
                if (dispChanged) {
                  $app.save(matchedDisp)
                }
              }
            } catch (_) {}
          }
        }
      } else if (claimsRes.statusCode === 403) {
        apiWarning =
          'API de Reclamações do Mercado Livre restrita por escopo da aplicação (403 Forbidden). O sistema mantém os dados operando 100% de modo manual/gerencial.'
      } else {
        apiWarning =
          'API do ML respondeu status ' +
          claimsRes.statusCode +
          '. O gerenciamento das exclusões segue plenamente funcional com dados manuais.'
      }
    } catch (httpErr) {
      apiWarning = 'Não foi possível consultar endpoint de claims do ML: ' + httpErr
    }

    return e.json(200, {
      ok: true,
      api_available: apiSuccess,
      api_status_code: apiStatusCode,
      claims_found: claimsFound,
      local_orders_linked: updatedLocalCount,
      warning: apiWarning || null,
      message: apiSuccess
        ? 'Claims e pedidos sincronizados com sucesso!'
        : 'Sincronização local concluída.' +
          (apiWarning ? ' ' + apiWarning : ' Gerenciamento manual ativo.'),
    })
  },
  $apis.requireAuth(),
)
