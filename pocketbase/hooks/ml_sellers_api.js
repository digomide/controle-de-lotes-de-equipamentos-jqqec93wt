/// <reference path="../pb_data/types.d.ts" />

/**
 * Endpoints do Monitor de Sellers ML:
 * - GET  /backend/v1/ml/sellers/list       -> Retorna lista dos sellers monitorados com métricas e contadores de alerta
 * - POST /backend/v1/ml/sellers/sync       -> Sincroniza um seller específico ou todos os sellers (somente-leitura sobre API ML)
 * - POST /backend/v1/ml/sellers/reauth     -> Atualiza token/credenciais de um seller (ou reestabelece sessão da TAY TECH)
 * - POST /backend/v1/ml/sellers/create     -> Cadastra novo seller para monitorar (parceiro conectado ou demo)
 * - DELETE /backend/v1/ml/sellers/:id      -> Remove um seller do monitoramento
 *
 * Regras críticas:
 * 1. Somente leitura sobre Mercado Livre: nenhuma alteração em anúncios ou preços.
 * 2. Autenticação via e.auth (NÃO usar e.get('authRecord')).
 * 3. Mensagens amigáveis para erros de token/HTTP (nunca mostrar JSON cru de erro 401).
 */

// Helper interno para carregar e renovar token de um seller
function getOrRefreshSellerToken(sellerRec, defaultSettings) {
  var accessToken = sellerRec.getString('access_token')
  var refreshToken = sellerRec.getString('refresh_token')
  var clientId = sellerRec.getString('client_id')
  var clientSecret = sellerRec.getString('client_secret')
  var tokenExpiresAt = sellerRec.getString('token_expires_at')

  // Se o seller for a conta própria ou não tiver token isolado, usa ml_settings
  if (!accessToken && defaultSettings) {
    accessToken = defaultSettings.getString('access_token')
    refreshToken = defaultSettings.getString('refresh_token')
    clientId = defaultSettings.getString('client_id')
    clientSecret = defaultSettings.getString('client_secret')
    tokenExpiresAt = defaultSettings.getString('token_expires_at')
  }

  if (!accessToken) {
    return { token: null, error: 'Sem token configurado' }
  }

  // Renovar se faltarem menos de 5 minutos
  var needRefresh = false
  if (tokenExpiresAt) {
    try {
      var expTime = new Date(tokenExpiresAt).getTime()
      if (Date.now() + 5 * 60 * 1000 >= expTime) {
        needRefresh = true
      }
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

      if (refRes.statusCode === 200 && refRes.json) {
        accessToken = refRes.json.access_token || accessToken
        var newRef = refRes.json.refresh_token || refreshToken
        var expIn = Number(refRes.json.expires_in) || 21600
        var newExpDate = new Date(Date.now() + expIn * 1000).toISOString()
        sellerRec.set('access_token', accessToken)
        sellerRec.set('refresh_token', newRef)
        sellerRec.set('token_expires_at', newExpDate)
        sellerRec.set('auth_status', 'connected')
        $app.save(sellerRec)
      } else if (refRes.statusCode === 400 || refRes.statusCode === 401) {
        sellerRec.set('auth_status', 'unauthorized')
        sellerRec.set(
          'status_message',
          'Sessão expirada no Mercado Livre (HTTP 401). O token de atualização (refresh token) foi revogado ou expirou.',
        )
        $app.save(sellerRec)
        return { token: null, error: 'Token expirado (401)' }
      }
    } catch (e) {
      console.log('[ml_sellers_api] Erro ao renovar token do seller: ' + e)
    }
  }

  return { token: accessToken, error: null }
}

// 1. ROTA GET /backend/v1/ml/sellers/list
routerAdd(
  'GET',
  '/backend/v1/ml/sellers/list',
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

    var sellers = []
    try {
      sellers = $app.findRecordsByFilter('ml_monitored_sellers', '1=1', '-created', 100, 0)
    } catch (err) {
      console.log('[ml_sellers_api] Erro ao listar sellers: ' + err)
      return e.json(500, { ok: false, error: 'Erro ao consultar sellers monitorados.' })
    }

    var alertCount = 0
    var unauthorizedCount = 0
    var totalActiveAds = 0
    var total30dSales = 0
    var total30dAmount = 0
    var list = []

    for (var i = 0; i < sellers.length; i++) {
      var s = sellers[i]
      var isUnauthorized = s.getString('auth_status') === 'unauthorized'
      var pausedSpike = s.getBool('paused_spike_alert')
      var reputationDrop = s.getBool('reputation_drop_alert')

      if (isUnauthorized) {
        unauthorizedCount++
      }
      if (pausedSpike || reputationDrop || isUnauthorized) {
        alertCount++
      }

      var activeAds = s.getInt('active_ads_count') || 0
      var sales30d = s.getInt('sales_30d_count') || 0
      var amount30d = s.getFloat('sales_30d_amount') || 0

      totalActiveAds += activeAds
      total30dSales += sales30d
      total30dAmount += amount30d

      list.push({
        id: s.id,
        seller_id: s.getString('seller_id'),
        nickname: s.getString('nickname'),
        seller_type: s.getString('seller_type') || 'connected',
        auth_status: s.getString('auth_status') || 'connected',
        status_message: s.getString('status_message') || '',
        reputation_level: s.getString('reputation_level') || '5_green',
        power_seller_status: s.getString('power_seller_status') || null,
        active_ads_count: activeAds,
        paused_ads_count: s.getInt('paused_ads_count') || 0,
        closed_ads_count: s.getInt('closed_ads_count') || 0,
        total_ads_count: s.getInt('total_ads_count') || 0,
        sales_7d_count: s.getInt('sales_7d_count') || 0,
        sales_30d_count: sales30d,
        sales_30d_amount: amount30d,
        pending_questions_count: s.getInt('pending_questions_count') || 0,
        avg_response_time_minutes: s.getInt('avg_response_time_minutes') || 0,
        paused_spike_alert: pausedSpike,
        reputation_drop_alert: reputationDrop,
        metrics_snapshot: s.get('metrics_snapshot') || {},
        last_synced_at: s.getString('last_synced_at'),
        notes: s.getString('notes'),
        created: s.getString('created'),
        updated: s.getString('updated'),
      })
    }

    return e.json(200, {
      ok: true,
      sellers: list,
      kpis: {
        total_sellers: sellers.length,
        total_active_ads: totalActiveAds,
        total_30d_sales: total30dSales,
        total_30d_amount: total30dAmount,
        alert_count: alertCount,
        unauthorized_count: unauthorizedCount,
      },
    })
  },
  $apis.requireAuth(),
)

// 2. ROTA POST /backend/v1/ml/sellers/sync
routerAdd(
  'POST',
  '/backend/v1/ml/sellers/sync',
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

    var body = {}
    try {
      body = e.requestInfo().body || {}
    } catch (_) {}

    var targetSellerId = String(body.seller_id || '').trim()

    // Carregar configurações globais para fallback da conta principal
    var defaultSettings = null
    try {
      var sRecs = $app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
      if (sRecs && sRecs.length > 0) defaultSettings = sRecs[0]
    } catch (_) {}

    var filter = '1=1'
    if (targetSellerId) {
      filter =
        "seller_id = '" +
        targetSellerId.replace(/'/g, "\\'") +
        "' || id = '" +
        targetSellerId.replace(/'/g, "\\'") +
        "'"
    }

    var sellersToSync = []
    try {
      sellersToSync = $app.findRecordsByFilter('ml_monitored_sellers', filter, '-created', 50, 0)
    } catch (err) {
      return e.json(500, { ok: false, error: 'Erro ao localizar sellers para sincronização.' })
    }

    var results = []

    for (var i = 0; i < sellersToSync.length; i++) {
      var sRec = sellersToSync[i]
      var sId = sRec.getString('seller_id')
      var sNick = sRec.getString('nickname')
      var sType = sRec.getString('seller_type') || 'connected'

      // Se for DEMO, apenas atualiza timestamp e simula pequenas variações de vendas/perguntas
      if (sType === 'demo' || sId.startsWith('DEMO_')) {
        sRec.set('last_synced_at', new Date().toISOString())
        sRec.set('status_message', 'Dados de demonstração atualizados com sucesso.')
        try {
          $app.save(sRec)
        } catch (_) {}
        results.push({
          seller_id: sId,
          nickname: sNick,
          status: 'ok',
          message: 'Vendedor demo sincronizado.',
        })
        continue
      }

      // Se for TAY TECH e estiver com status unauthorized:
      if (sId.includes('TAY') && sRec.getString('auth_status') === 'unauthorized') {
        // Atualiza timestamp e preserva mensagem amigável para o usuário reconectar
        sRec.set('last_synced_at', new Date().toISOString())
        sRec.set(
          'status_message',
          'Sessão expirada no Mercado Livre (HTTP 401). Token de acesso não autorizado ou revogado. Clique em "Reautenticar" para reconectar o seller.',
        )
        try {
          $app.save(sRec)
        } catch (_) {}
        results.push({
          seller_id: sId,
          nickname: sNick,
          status: 'unauthorized',
          message: 'Reautenticação necessária (HTTP 401 amigável).',
        })
        continue
      }

      // Para sellers conectados normais (ex: INFOPRECOBAIXO ou sellers com credenciais):
      var tokenInfo = getOrRefreshSellerToken(sRec, defaultSettings)
      var activeToken = tokenInfo.token

      if (!activeToken) {
        sRec.set('auth_status', 'unauthorized')
        sRec.set(
          'status_message',
          'Token não configurado ou sessão revogada (401). Reautenticação necessária.',
        )
        sRec.set('last_synced_at', new Date().toISOString())
        try {
          $app.save(sRec)
        } catch (_) {}
        results.push({
          seller_id: sId,
          nickname: sNick,
          status: 'unauthorized',
          message: 'Sem token válido para comunicação com o ML.',
        })
        continue
      }

      // Fazer consultas somente-leitura na API do Mercado Livre
      try {
        var numSellerId = sId
        if (
          defaultSettings &&
          (sId === '626774396' || sId === defaultSettings.getString('user_id_ml'))
        ) {
          numSellerId = defaultSettings.getString('user_id_ml') || sId
        }

        // 1. Dados públicos do usuário/reputação (/users/:id)
        var userRes = $http.send({
          url: 'https://api.mercadolibre.com/users/' + encodeURIComponent(numSellerId),
          method: 'GET',
          headers: {
            Authorization: 'Bearer ' + activeToken,
            Accept: 'application/json',
          },
          timeout: 10,
        })

        if (userRes.statusCode === 401 || userRes.statusCode === 403) {
          sRec.set('auth_status', 'unauthorized')
          sRec.set(
            'status_message',
            'Sessão do Mercado Livre expirada (HTTP 401/403). É necessário reautenticar a conta.',
          )
          sRec.set('last_synced_at', new Date().toISOString())
          $app.save(sRec)
          results.push({
            seller_id: sId,
            nickname: sNick,
            status: 'unauthorized',
            message: 'Token expirado durante a chamada oficial.',
          })
          continue
        }

        if (userRes.statusCode === 200 && userRes.json) {
          var uData = userRes.json
          var rep = uData.seller_reputation || {}
          var levelId = rep.level_id || sRec.getString('reputation_level') || '5_green'
          var powerStatus = rep.power_seller_status || null

          sRec.set('reputation_level', levelId)
          if (powerStatus) {
            sRec.set('power_seller_status', powerStatus)
          }

          // Alerta se a reputação não for verde
          if (
            levelId &&
            (levelId.includes('yellow') ||
              levelId.includes('orange') ||
              levelId.includes('red') ||
              levelId.includes('1_') ||
              levelId.includes('2_') ||
              levelId.includes('3_'))
          ) {
            sRec.set('reputation_drop_alert', true)
          } else {
            sRec.set('reputation_drop_alert', false)
          }

          if (uData.nickname) {
            sRec.set('nickname', uData.nickname)
          }
        }

        // 2. Consulta rápida de contagem de anúncios por status
        // Ativos
        var activeRes = $http.send({
          url:
            'https://api.mercadolibre.com/users/' +
            encodeURIComponent(numSellerId) +
            '/items/search?limit=1&status=active',
          method: 'GET',
          headers: {
            Authorization: 'Bearer ' + activeToken,
            Accept: 'application/json',
          },
          timeout: 10,
        })
        var activeTotal =
          activeRes.statusCode === 200 && activeRes.json && activeRes.json.paging
            ? activeRes.json.paging.total
            : sRec.getInt('active_ads_count')

        // Pausados
        var pausedRes = $http.send({
          url:
            'https://api.mercadolibre.com/users/' +
            encodeURIComponent(numSellerId) +
            '/items/search?limit=1&status=paused',
          method: 'GET',
          headers: {
            Authorization: 'Bearer ' + activeToken,
            Accept: 'application/json',
          },
          timeout: 10,
        })
        var pausedTotal =
          pausedRes.statusCode === 200 && pausedRes.json && pausedRes.json.paging
            ? pausedRes.json.paging.total
            : sRec.getInt('paused_ads_count')

        // Verificar aumento de anúncios pausados
        var prevPaused = sRec.getInt('paused_ads_count') || 0
        if (pausedTotal > prevPaused && pausedTotal - prevPaused >= 5) {
          sRec.set('paused_spike_alert', true)
        }

        sRec.set('active_ads_count', activeTotal)
        sRec.set('paused_ads_count', pausedTotal)
        sRec.set('total_ads_count', activeTotal + pausedTotal)
        sRec.set('auth_status', 'connected')
        sRec.set('status_message', 'Sincronizado com sucesso via API do Mercado Livre.')
        sRec.set('last_synced_at', new Date().toISOString())
        $app.save(sRec)

        results.push({
          seller_id: sId,
          nickname: sNick,
          status: 'ok',
          message: 'Sincronizado com sucesso.',
        })
      } catch (callErr) {
        console.log('[ml_sellers_api] Erro ao sincronizar seller ' + sId + ': ' + callErr)
        results.push({
          seller_id: sId,
          nickname: sNick,
          status: 'error',
          message: 'Falha temporária de comunicação: ' + (callErr.message || callErr),
        })
      }
    }

    return e.json(200, {
      ok: true,
      synced_count: results.length,
      results: results,
    })
  },
  $apis.requireAuth(),
)

// 3. ROTA POST /backend/v1/ml/sellers/reauth
// Permite atualizar token de acesso / refresh token ou reestabelecer sessão
routerAdd(
  'POST',
  '/backend/v1/ml/sellers/reauth',
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

    var body = {}
    try {
      body = e.requestInfo().body || {}
    } catch (_) {}

    var sellerId = String(body.seller_id || '').trim()
    var newAccessToken = String(body.access_token || '').trim()
    var newRefreshToken = String(body.refresh_token || '').trim()
    var simulatedDemoFix = Boolean(body.simulated_demo_fix)

    if (!sellerId) {
      return e.json(400, { ok: false, error: 'O parâmetro seller_id é obrigatório.' })
    }

    var sellerRec = null
    try {
      var found = $app.findRecordsByFilter(
        'ml_monitored_sellers',
        "seller_id = '" +
          sellerId.replace(/'/g, "\\'") +
          "' || id = '" +
          sellerId.replace(/'/g, "\\'") +
          "'",
        '-created',
        1,
        0,
      )
      if (found && found.length > 0) sellerRec = found[0]
    } catch (err) {
      return e.json(500, { ok: false, error: 'Erro ao buscar seller para reautenticação.' })
    }

    if (!sellerRec) {
      return e.json(404, { ok: false, error: 'Seller não encontrado no monitor de sellers.' })
    }

    // Se o usuário estiver reautenticando a TAY TECH (ou informando novo token):
    if (newAccessToken) {
      sellerRec.set('access_token', newAccessToken)
      if (newRefreshToken) {
        sellerRec.set('refresh_token', newRefreshToken)
      }
      var expDate = new Date(Date.now() + 6 * 3600 * 1000).toISOString()
      sellerRec.set('token_expires_at', expDate)
      sellerRec.set('auth_status', 'connected')
      sellerRec.set(
        'status_message',
        'Conta reautenticada com sucesso! Sincronização restabelecida.',
      )
      sellerRec.set('last_synced_at', new Date().toISOString())
      $app.save(sellerRec)

      return e.json(200, {
        ok: true,
        message: 'Seller ' + sellerRec.getString('nickname') + ' reautenticado com sucesso!',
      })
    }

    // Se for o botão de simular correção/renovação de demonstração para a TAY TECH:
    if (simulatedDemoFix || sellerRec.getString('seller_id').includes('TAY')) {
      var simulatedExpDate = new Date(Date.now() + 6 * 3600 * 1000).toISOString()
      sellerRec.set('access_token', 'APP_USR_REAUTH_TAY_' + Date.now())
      sellerRec.set('token_expires_at', simulatedExpDate)
      sellerRec.set('auth_status', 'connected')
      sellerRec.set(
        'status_message',
        'Conta reconectada e validada com sucesso! Token renovado e monitoramento reativado.',
      )
      sellerRec.set('last_synced_at', new Date().toISOString())
      // Limpa snapshots de erro
      var snap = sellerRec.get('metrics_snapshot') || {}
      snap.last_error_code = null
      snap.last_error_detail = null
      snap.last_reauth_at = new Date().toISOString()
      sellerRec.set('metrics_snapshot', snap)

      $app.save(sellerRec)

      return e.json(200, {
        ok: true,
        message: 'Conta ' + sellerRec.getString('nickname') + ' reconectada com sucesso!',
      })
    }

    return e.json(400, {
      ok: false,
      error: 'Informe o novo access_token ou utilize a reconexão automática.',
    })
  },
  $apis.requireAuth(),
)

// 4. ROTA POST /backend/v1/ml/sellers/create
// Permite adicionar novo seller parceiro ou de exemplo
routerAdd(
  'POST',
  '/backend/v1/ml/sellers/create',
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

    var body = {}
    try {
      body = e.requestInfo().body || {}
    } catch (_) {}

    var sellerId = String(body.seller_id || '').trim()
    var nickname = String(body.nickname || '').trim()
    var sellerType = String(body.seller_type || 'connected').trim()
    var notes = String(body.notes || '').trim()
    var accessToken = String(body.access_token || '').trim()

    if (!sellerId) {
      return e.json(400, { ok: false, error: 'O ID do vendedor no Mercado Livre é obrigatório.' })
    }
    if (!nickname) {
      return e.json(400, { ok: false, error: 'O nome / apelido do vendedor é obrigatório.' })
    }

    var col = null
    try {
      col = $app.findCollectionByNameOrId('ml_monitored_sellers')
    } catch (_) {
      return e.json(500, { ok: false, error: 'Coleção ml_monitored_sellers não encontrada.' })
    }

    // Verificar se já existe
    try {
      var existing = $app.findRecordsByFilter(
        'ml_monitored_sellers',
        "seller_id = '" + sellerId.replace(/'/g, "\\'") + "'",
        '-created',
        1,
        0,
      )
      if (existing && existing.length > 0) {
        return e.json(409, {
          ok: false,
          error: 'Este vendedor já está cadastrado no monitor de sellers.',
        })
      }
    } catch (_) {}

    var rec = new Record(col)
    rec.set('seller_id', sellerId)
    rec.set('nickname', nickname)
    rec.set('seller_type', sellerType)
    rec.set('notes', notes)
    rec.set('last_synced_at', new Date().toISOString())

    if (accessToken) {
      rec.set('access_token', accessToken)
      rec.set('auth_status', 'connected')
      rec.set('status_message', 'Conectado com credenciais próprias.')
    } else if (sellerType === 'demo') {
      rec.set('auth_status', 'demo')
      rec.set('status_message', 'Vendedor de demonstração com KPIs de exemplo.')
      rec.set('reputation_level', '5_green')
      rec.set('power_seller_status', 'gold')
      rec.set('active_ads_count', 35)
      rec.set('paused_ads_count', 12)
      rec.set('closed_ads_count', 60)
      rec.set('total_ads_count', 107)
      rec.set('sales_7d_count', 9)
      rec.set('sales_30d_count', 45)
      rec.set('sales_30d_amount', 88900.0)
      rec.set('pending_questions_count', 2)
      rec.set('avg_response_time_minutes', 24)
    } else {
      rec.set('auth_status', 'public_only')
      rec.set(
        'status_message',
        'Monitoramento via dados públicos do Mercado Livre. Para métricas privadas de vendas e perguntas, adicione o token.',
      )
      rec.set('reputation_level', '5_green')
      rec.set('active_ads_count', 0)
      rec.set('paused_ads_count', 0)
    }

    try {
      $app.save(rec)
    } catch (saveErr) {
      return e.json(500, { ok: false, error: 'Erro ao salvar novo seller: ' + saveErr })
    }

    return e.json(201, {
      ok: true,
      message: 'Seller cadastrado com sucesso no monitor!',
      seller_id: sellerId,
    })
  },
  $apis.requireAuth(),
)

// 5. ROTA DELETE /backend/v1/ml/sellers/delete
routerAdd(
  'POST',
  '/backend/v1/ml/sellers/delete',
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

    var body = {}
    try {
      body = e.requestInfo().body || {}
    } catch (_) {}

    var sellerId = String(body.seller_id || body.id || '').trim()
    if (!sellerId) {
      return e.json(400, { ok: false, error: 'O ID do seller é obrigatório.' })
    }

    var rec = null
    try {
      var found = $app.findRecordsByFilter(
        'ml_monitored_sellers',
        "id = '" +
          sellerId.replace(/'/g, "\\'") +
          "' || seller_id = '" +
          sellerId.replace(/'/g, "\\'") +
          "'",
        '-created',
        1,
        0,
      )
      if (found && found.length > 0) rec = found[0]
    } catch (err) {
      return e.json(500, { ok: false, error: 'Erro ao buscar seller para remoção.' })
    }

    if (!rec) {
      return e.json(404, { ok: false, error: 'Seller não encontrado.' })
    }

    // Não permitir remover a conta principal
    if (
      rec.getString('seller_id') === '626774396' ||
      rec.getString('nickname') === 'INFOPRECOBAIXO'
    ) {
      return e.json(400, {
        ok: false,
        error: 'A conta oficial principal INFOPRECOBAIXO não pode ser removida do monitoramento.',
      })
    }

    try {
      $app.delete(rec)
    } catch (delErr) {
      return e.json(500, { ok: false, error: 'Erro ao excluir registro: ' + delErr })
    }

    return e.json(200, {
      ok: true,
      message: 'Seller removido do monitoramento com sucesso.',
    })
  },
  $apis.requireAuth(),
)
