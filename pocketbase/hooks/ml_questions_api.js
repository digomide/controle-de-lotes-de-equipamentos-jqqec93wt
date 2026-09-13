/// <reference path="../pb_data/types.d.ts" />

/**
 * Endpoints da Central de Perguntas ML:
 * - POST /backend/v1/ml/questions/sync    -> Sincroniza perguntas e dispara motor de auto-resposta quando ativado
 * - POST /backend/v1/ml/questions/answer  -> Responde uma pergunta via API do ML (POST /answers com fallback POST /questions/{id}/answers)
 * - GET  /backend/v1/ml/questions/metrics -> Retorna métricas e contadores de SLA em tempo real
 *
 * Regra do runtime Goja / Skip Cloud: todas as funções e variáveis devem ser inline dentro de cada callback.
 */

// 1. ROTA POST /backend/v1/ml/questions/sync
routerAdd(
  'POST',
  '/backend/v1/ml/questions/sync',
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

    // Carregar ml_settings
    var sRecords = []
    try {
      sRecords = $app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    } catch (err) {
      console.log('[ml_questions_api] Erro ao carregar ml_settings: ' + err)
    }

    if (!sRecords || sRecords.length === 0) {
      return e.json(400, {
        ok: false,
        error: 'Configurações do Mercado Livre não encontradas no sistema.',
      })
    }

    var settings = sRecords[0]
    var accessToken = settings.getString('access_token')
    var refreshToken = settings.getString('refresh_token')
    var clientId = settings.getString('client_id')
    var clientSecret = settings.getString('client_secret')
    var tokenExpiresAt = settings.getString('token_expires_at')
    var sellerId = settings.getString('user_id_ml')

    if (!accessToken || !sellerId) {
      return e.json(400, {
        ok: false,
        error: 'Mercado Livre não está conectado ou não possui ID do vendedor.',
      })
    }

    // Renovar token se necessário
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
          timeout: 20,
        })

        if (refRes.statusCode === 200 && refRes.json) {
          accessToken = refRes.json.access_token || accessToken
          var newRef = refRes.json.refresh_token || refreshToken
          var expIn = Number(refRes.json.expires_in) || 21600
          var newExpDate = new Date(Date.now() + expIn * 1000).toISOString()
          settings.set('access_token', accessToken)
          settings.set('refresh_token', newRef)
          settings.set('token_expires_at', newExpDate)
          $app.save(settings)
          console.log('[ml_questions_api] Token renovado com sucesso para a Central de Perguntas.')
        }
      } catch (rErr) {
        console.log('[ml_questions_api] Erro ao renovar token ML: ' + rErr)
      }
    }

    // Carregar configurações da auto-resposta
    var configRecord = null
    try {
      var cRecords = $app.findRecordsByFilter('ml_questions_config', '1=1', '-created', 1, 0)
      if (cRecords && cRecords.length > 0) {
        configRecord = cRecords[0]
      }
    } catch (cErr) {
      console.log('[ml_questions_api] Erro ao carregar ml_questions_config: ' + cErr)
    }

    var autoReplyEnabled = configRecord
      ? Boolean(configRecord.getBool('auto_reply_enabled'))
      : false
    var autoReplyTextTemplate = configRecord ? configRecord.getString('auto_reply_text') : ''

    // Helper interno para saudação em Brasília
    var greeting = 'Olá'
    try {
      var now = new Date()
      var utcHour = now.getUTCHours()
      var brHour = (utcHour - 3 + 24) % 24
      if (brHour >= 5 && brHour < 12) {
        greeting = 'Bom dia'
      } else if (brHour >= 12 && brHour < 18) {
        greeting = 'Boa tarde'
      } else {
        greeting = 'Boa noite'
      }
    } catch (_) {}

    // Buscar UNANSWERED do vendedor
    var searchUrl =
      'https://api.mercadolibre.com/questions/search?seller_id=' +
      encodeURIComponent(sellerId) +
      '&status=UNANSWERED&sort_fields=date_created&sort_types=DESC&limit=50'

    var res = null
    try {
      res = $http.send({
        url: searchUrl,
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + accessToken,
          Accept: 'application/json',
        },
        timeout: 25,
      })
    } catch (netErr) {
      return e.json(502, {
        ok: false,
        error:
          'Falha de rede ao consultar perguntas no Mercado Livre: ' + (netErr.message || netErr),
      })
    }

    if (res.statusCode >= 400) {
      var errJson = res.json || {}
      var errMsg =
        errJson.message || errJson.error_description || errJson.error || 'HTTP ' + res.statusCode
      return e.json(res.statusCode, {
        ok: false,
        error: 'Erro retornado pela API do Mercado Livre: ' + errMsg,
      })
    }

    var body = res.json || {}
    var rawQuestions = Array.isArray(body.questions) ? body.questions : []

    var cacheCol = null
    try {
      cacheCol = $app.findCollectionByNameOrId('ml_questions_cache')
    } catch (ccErr) {
      return e.json(500, { ok: false, error: 'Coleção ml_questions_cache não encontrada.' })
    }

    var savedCount = 0
    var autoRepliedCount = 0
    var itemDetailsCache = {}

    // Processar cada pergunta não respondida
    for (var i = 0; i < rawQuestions.length; i++) {
      var q = rawQuestions[i]
      if (!q || !q.id) continue

      var questionIdStr = String(q.id)
      var itemId = q.item_id ? String(q.item_id) : ''
      var buyerId = q.from && q.from.id ? String(q.from.id) : ''
      var dateCreated = q.date_created || new Date().toISOString()
      var text = q.text || ''
      var statusML = q.status || 'UNANSWERED'

      // Buscar se já existe no cache
      var existing = null
      try {
        existing = $app.findFirstRecordByFilter(
          'ml_questions_cache',
          "question_id = '" + questionIdStr + "'",
        )
      } catch (_) {}

      var rec = existing || new Record(cacheCol)
      rec.set('question_id', questionIdStr)
      rec.set('item_id', itemId)
      rec.set('buyer_id', buyerId)
      rec.set('text', text)
      rec.set('date_created', dateCreated)
      rec.set('status_ml', statusML)
      rec.set('raw_data', q)

      // Se ainda não temos dados do produto (título, preço, imagem), buscar do ML
      var currentItemTitle = existing ? existing.getString('item_title') : ''
      if (!currentItemTitle && itemId) {
        if (!itemDetailsCache[itemId]) {
          try {
            var itemRes = $http.send({
              url: 'https://api.mercadolibre.com/items/' + encodeURIComponent(itemId),
              method: 'GET',
              headers: {
                Authorization: 'Bearer ' + accessToken,
                Accept: 'application/json',
              },
              timeout: 10,
            })
            if (itemRes.statusCode === 200 && itemRes.json) {
              itemDetailsCache[itemId] = itemRes.json
            }
          } catch (_) {}
        }

        var it = itemDetailsCache[itemId]
        if (it) {
          rec.set('item_title', it.title || '')
          rec.set('item_permalink', it.permalink || '')
          rec.set('item_thumbnail', it.thumbnail || '')
          rec.set('item_price', Number(it.price || 0))
        }
      }

      // Upsert do comprador em ml_customers se tivermos buyer_id
      if (buyerId && (!existing || !existing.getString('buyer_nickname'))) {
        try {
          var custRec = null
          try {
            custRec = $app.findFirstRecordByFilter('ml_customers', "buyer_id = '" + buyerId + "'")
          } catch (_) {}

          if (custRec) {
            rec.set(
              'buyer_nickname',
              custRec.getString('nickname') || custRec.getString('name') || '',
            )
          }
        } catch (_) {}
      }

      // Se for novo ou ainda não respondido:
      var isAlreadyAutoReplied = existing ? existing.getBool('initial_auto_reply_sent') : false
      var isRealReplySent = existing ? existing.getBool('real_reply_sent') : false

      if (!existing) {
        rec.set('queue_status', 'unanswered')
        rec.set('initial_auto_reply_sent', false)
        rec.set('real_reply_sent', false)
      }

      // DISPARO DO MOTOR DE AUTO-RESPOSTA:
      // Apenas se auto-resposta estiver LIGADA, nunca tiver sido enviada para essa pergunta
      // e o usuário humano ainda não tiver respondido.
      if (autoReplyEnabled && !isAlreadyAutoReplied && !isRealReplySent && autoReplyTextTemplate) {
        var finalAutoReply = greeting + '! ' + autoReplyTextTemplate.trim()
        var numQId = Number(questionIdStr)
        var qPayloadId = !isNaN(numQId) && numQId > 0 ? numQId : questionIdStr

        var sendSuccess = false
        var lastErr = ''

        // Tentativa 1: POST /answers
        try {
          var aRes1 = $http.send({
            url: 'https://api.mercadolibre.com/answers',
            method: 'POST',
            headers: {
              Authorization: 'Bearer ' + accessToken,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({
              question_id: qPayloadId,
              text: finalAutoReply,
            }),
            timeout: 20,
          })
          if (aRes1.statusCode >= 200 && aRes1.statusCode < 300) {
            sendSuccess = true
          } else {
            lastErr =
              (aRes1.json && (aRes1.json.message || aRes1.json.error)) || 'HTTP ' + aRes1.statusCode
          }
        } catch (e1) {
          lastErr = String(e1.message || e1)
        }

        // Tentativa 2: fallback POST /questions/{id}/answers
        if (!sendSuccess) {
          try {
            var aRes2 = $http.send({
              url:
                'https://api.mercadolibre.com/questions/' +
                encodeURIComponent(questionIdStr) +
                '/answers',
              method: 'POST',
              headers: {
                Authorization: 'Bearer ' + accessToken,
                'Content-Type': 'application/json',
                Accept: 'application/json',
              },
              body: JSON.stringify({
                text: finalAutoReply,
              }),
              timeout: 20,
            })
            if (aRes2.statusCode >= 200 && aRes2.statusCode < 300) {
              sendSuccess = true
            } else {
              lastErr =
                (aRes2.json && (aRes2.json.message || aRes2.json.error)) ||
                'HTTP ' + aRes2.statusCode
            }
          } catch (e2) {
            lastErr = String(e2.message || e2)
          }
        }

        if (sendSuccess) {
          rec.set('initial_auto_reply_sent', true)
          rec.set('initial_auto_reply_text', finalAutoReply)
          rec.set('initial_auto_reply_sent_at', new Date().toISOString())
          // REGRA CRÍTICA DO USUÁRIO: Como a API do ML marca como respondida, no nosso gestor
          // ela DEVE ficar na fila como "auto_replied" (selo "Aguardando resposta real")
          rec.set('queue_status', 'auto_replied')
          autoRepliedCount++
          console.log(
            '[ml_questions_api] Auto-resposta inicial enviada com sucesso para pergunta ' +
              questionIdStr,
          )
        } else {
          console.log(
            '[ml_questions_api] Falha ao enviar auto-resposta para ' +
              questionIdStr +
              ': ' +
              lastErr,
          )
        }
      }

      try {
        $app.save(rec)
        savedCount++
      } catch (sErr) {
        console.log('[ml_questions_api] Erro ao salvar pergunta ' + questionIdStr + ': ' + sErr)
      }
    }

    // Buscar também as últimas 30 perguntas respondidas para manter histórico atualizado
    try {
      var answeredUrl =
        'https://api.mercadolibre.com/questions/search?seller_id=' +
        encodeURIComponent(sellerId) +
        '&status=ANSWERED&sort_fields=date_created&sort_types=DESC&limit=30'

      var aRes = $http.send({
        url: answeredUrl,
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + accessToken,
          Accept: 'application/json',
        },
        timeout: 20,
      })

      if (aRes.statusCode === 200 && aRes.json && Array.isArray(aRes.json.questions)) {
        var answeredList = aRes.json.questions
        for (var j = 0; j < answeredList.length; j++) {
          var aq = answeredList[j]
          if (!aq || !aq.id) continue

          var aQIdStr = String(aq.id)
          var aExisting = null
          try {
            aExisting = $app.findFirstRecordByFilter(
              'ml_questions_cache',
              "question_id = '" + aQIdStr + "'",
            )
          } catch (_) {}

          var aRec = aExisting || new Record(cacheCol)
          aRec.set('question_id', aQIdStr)
          aRec.set('item_id', aq.item_id ? String(aq.item_id) : '')
          aRec.set('buyer_id', aq.from && aq.from.id ? String(aq.from.id) : '')
          aRec.set('text', aq.text || '')
          aRec.set('date_created', aq.date_created || new Date().toISOString())
          aRec.set('status_ml', 'ANSWERED')
          aRec.set('raw_data', aq)

          var mlAnswerObj = aq.answer || {}
          var mlAnswerText = mlAnswerObj.text || ''
          var mlAnswerDate = mlAnswerObj.date_created || null

          // Se a pergunta foi respondida no ML e no nosso sistema ainda estava como unanswered,
          // ou se foi uma resposta humana:
          var knownAutoText = aRec.getString('initial_auto_reply_text')
          var hasAutoFlag = aRec.getBool('initial_auto_reply_sent')

          if (
            hasAutoFlag &&
            knownAutoText &&
            mlAnswerText === knownAutoText &&
            !aRec.getBool('real_reply_sent')
          ) {
            // Permanece como auto_replied aguardando resposta real!
            aRec.set('queue_status', 'auto_replied')
          } else if (mlAnswerText) {
            // Foi respondida de verdade!
            aRec.set('queue_status', 'answered')
            aRec.set('real_reply_sent', true)
            aRec.set('real_reply_text', mlAnswerText)
            if (mlAnswerDate) {
              aRec.set('real_reply_sent_at', mlAnswerDate)
            }
          }

          // Preencher dados do item se ausente
          var aItemId = aRec.getString('item_id')
          if (!aRec.getString('item_title') && aItemId) {
            if (!itemDetailsCache[aItemId]) {
              try {
                var itRes = $http.send({
                  url: 'https://api.mercadolibre.com/items/' + encodeURIComponent(aItemId),
                  method: 'GET',
                  headers: {
                    Authorization: 'Bearer ' + accessToken,
                    Accept: 'application/json',
                  },
                  timeout: 8,
                })
                if (itRes.statusCode === 200 && itRes.json) {
                  itemDetailsCache[aItemId] = itRes.json
                }
              } catch (_) {}
            }

            var itObj = itemDetailsCache[aItemId]
            if (itObj) {
              aRec.set('item_title', itObj.title || '')
              aRec.set('item_permalink', itObj.permalink || '')
              aRec.set('item_thumbnail', itObj.thumbnail || '')
              aRec.set('item_price', Number(itObj.price || 0))
            }
          }

          try {
            $app.save(aRec)
          } catch (_) {}
        }
      }
    } catch (aErr) {
      console.log('[ml_questions_api] Aviso ao sincronizar perguntas ANSWERED: ' + aErr)
    }

    return e.json(200, {
      ok: true,
      total_unanswered_in_ml: rawQuestions.length,
      saved_count: savedCount,
      auto_replied_count: autoRepliedCount,
      auto_reply_enabled: autoReplyEnabled,
    })
  },
  $apis.requireAuth(),
)

// 2. ROTA POST /backend/v1/ml/questions/answer
routerAdd(
  'POST',
  '/backend/v1/ml/questions/answer',
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

    var questionId = String(body.question_id || '').trim()
    var answerText = String(body.text || '').trim()
    var saveAsTemplate = Boolean(body.save_as_template)
    var templateTitle = String(body.template_title || '').trim()
    var templateCategory = String(body.template_category || 'geral').trim()

    if (!questionId) {
      return e.json(400, { ok: false, error: 'O campo question_id é obrigatório.' })
    }

    if (!answerText) {
      return e.json(400, { ok: false, error: 'O texto da resposta não pode ficar em branco.' })
    }

    // Carregar ml_settings
    var sRecords = []
    try {
      sRecords = $app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    } catch (err) {
      console.log('[ml_questions_api] Erro ao carregar ml_settings: ' + err)
    }

    if (!sRecords || sRecords.length === 0) {
      return e.json(400, {
        ok: false,
        error: 'Configurações do Mercado Livre não encontradas no sistema.',
      })
    }

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
          timeout: 20,
        })

        if (refRes.statusCode === 200 && refRes.json) {
          accessToken = refRes.json.access_token || accessToken
          var newRef = refRes.json.refresh_token || refreshToken
          var expIn = Number(refRes.json.expires_in) || 21600
          var newExpDate = new Date(Date.now() + expIn * 1000).toISOString()
          settings.set('access_token', accessToken)
          settings.set('refresh_token', newRef)
          settings.set('token_expires_at', newExpDate)
          $app.save(settings)
        }
      } catch (rErr) {
        console.log('[ml_questions_api] Erro ao renovar token ML: ' + rErr)
      }
    }

    if (!accessToken) {
      return e.json(400, { ok: false, error: 'Mercado Livre sem token de acesso ativo.' })
    }

    // 1. Enviar resposta para a API do Mercado Livre
    var numQId = Number(questionId)
    var qPayloadId = !isNaN(numQId) && numQId > 0 ? numQId : questionId

    var sendSuccess = false
    var lastErr = ''

    // Tentativa 1: POST /answers
    try {
      var aRes1 = $http.send({
        url: 'https://api.mercadolibre.com/answers',
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + accessToken,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          question_id: qPayloadId,
          text: answerText,
        }),
        timeout: 20,
      })
      if (aRes1.statusCode >= 200 && aRes1.statusCode < 300) {
        sendSuccess = true
      } else {
        lastErr =
          (aRes1.json &&
            (aRes1.json.message || aRes1.json.error_description || aRes1.json.error)) ||
          'HTTP ' + aRes1.statusCode
      }
    } catch (e1) {
      lastErr = String(e1.message || e1)
    }

    // Tentativa 2: fallback POST /questions/{id}/answers
    if (!sendSuccess) {
      try {
        var aRes2 = $http.send({
          url:
            'https://api.mercadolibre.com/questions/' + encodeURIComponent(questionId) + '/answers',
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + accessToken,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            text: answerText,
          }),
          timeout: 20,
        })
        if (aRes2.statusCode >= 200 && aRes2.statusCode < 300) {
          sendSuccess = true
        } else {
          lastErr =
            (aRes2.json &&
              (aRes2.json.message || aRes2.json.error_description || aRes2.json.error)) ||
            'HTTP ' + aRes2.statusCode
        }
      } catch (e2) {
        lastErr = String(e2.message || e2)
      }
    }

    if (!sendSuccess) {
      return e.json(400, {
        ok: false,
        error: 'Não foi possível enviar a resposta ao Mercado Livre: ' + lastErr,
      })
    }

    // 2. Atualizar registro no cache local
    var rec = null
    try {
      rec = $app.findFirstRecordByFilter('ml_questions_cache', "question_id = '" + questionId + "'")
    } catch (_) {}

    var responderName = authRecord.getString('name') || authRecord.getString('email') || 'Usuário'
    var nowIso = new Date().toISOString()
    var slaMinutes = 0

    if (rec) {
      var dateCreatedStr = rec.getString('date_created')
      if (dateCreatedStr) {
        try {
          var createdMs = new Date(dateCreatedStr).getTime()
          var diffMs = Date.now() - createdMs
          slaMinutes = Math.max(1, Math.round(diffMs / (60 * 1000)))
        } catch (_) {}
      }

      rec.set('queue_status', 'answered')
      rec.set('real_reply_sent', true)
      rec.set('real_reply_text', answerText)
      rec.set('real_reply_sent_at', nowIso)
      rec.set('real_reply_user_name', responderName)
      rec.set('status_ml', 'ANSWERED')
      if (slaMinutes > 0) {
        rec.set('sla_minutes_to_real_reply', slaMinutes)
      }
      try {
        $app.save(rec)
      } catch (errRec) {
        console.log('[ml_questions_api] Aviso ao salvar status no cache: ' + errRec)
      }
    }

    // 3. Salvar como novo template na base que aprende se solicitado
    if (saveAsTemplate) {
      try {
        var tCol = $app.findCollectionByNameOrId('ml_question_templates')
        var newT = new Record(tCol)
        newT.set('title', templateTitle || 'Resposta ' + new Date().toLocaleDateString('pt-BR'))
        newT.set('category', templateCategory)
        newT.set('content', answerText)
        newT.set('active', true)
        newT.set('times_used', 1)

        var words = answerText
          .toLowerCase()
          .replace(/[^\w\s]/g, '')
          .split(/\s+/)
          .filter(function (w) {
            return w.length > 3
          })
          .slice(0, 8)
        newT.set('keywords', words)
        $app.save(newT)
      } catch (tErr) {
        console.log('[ml_questions_api] Aviso ao salvar template: ' + tErr)
      }
    }

    return e.json(200, {
      ok: true,
      question_id: questionId,
      answer_text: answerText,
      sla_minutes: slaMinutes,
      responder: responderName,
      message: 'Resposta enviada com sucesso ao Mercado Livre!',
    })
  },
  $apis.requireAuth(),
)

// 3. ROTA GET /backend/v1/ml/questions/metrics
routerAdd(
  'GET',
  '/backend/v1/ml/questions/metrics',
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

    var records = []
    try {
      records = $app.findRecordsByFilter(
        'ml_questions_cache',
        '1=1',
        '-date_created,-created',
        500,
        0,
      )
    } catch (err) {
      console.log('[ml_questions_api] Erro ao buscar registros para metrics: ' + err)
    }

    var now = Date.now()
    var pendingUnanswered = 0
    var waitingRealReply = 0
    var answeredCount = 0
    var criticalCount = 0
    var warningCount = 0
    var answeredToday = 0

    var slaSumMinutes = 0
    var slaCount = 0

    var todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    var todayStartMs = todayStart.getTime()

    var productQuestionsMap = {}

    for (var i = 0; i < records.length; i++) {
      var r = records[i]
      if (!r) continue

      var status = r.getString('queue_status') || 'unanswered'
      var dateCreatedStr = r.getString('date_created')
      var createdMs = dateCreatedStr ? new Date(dateCreatedStr).getTime() : now
      var ageHours = (now - createdMs) / (1000 * 60 * 60)

      var itemId = r.getString('item_id') || 'MLB-Geral'
      var itemTitle = r.getString('item_title') || 'Anúncio sem título'
      var itemPermalink = r.getString('item_permalink') || ''

      if (!productQuestionsMap[itemId]) {
        productQuestionsMap[itemId] = {
          item_id: itemId,
          item_title: itemTitle,
          item_permalink: itemPermalink,
          total_questions: 0,
          pending_questions: 0,
          sample_texts: [],
        }
      }
      productQuestionsMap[itemId].total_questions++

      if (status === 'unanswered') {
        pendingUnanswered++
        productQuestionsMap[itemId].pending_questions++
        if (productQuestionsMap[itemId].sample_texts.length < 3) {
          productQuestionsMap[itemId].sample_texts.push(r.getString('text'))
        }
        if (ageHours >= 4) {
          criticalCount++
        } else if (ageHours >= 1) {
          warningCount++
        }
      } else if (status === 'auto_replied') {
        waitingRealReply++
        productQuestionsMap[itemId].pending_questions++
        if (productQuestionsMap[itemId].sample_texts.length < 3) {
          productQuestionsMap[itemId].sample_texts.push(r.getString('text'))
        }
        if (ageHours >= 4) {
          criticalCount++
        } else if (ageHours >= 1) {
          warningCount++
        }
      } else if (status === 'answered') {
        answeredCount++
        var sentAtStr = r.getString('real_reply_sent_at')
        if (sentAtStr && new Date(sentAtStr).getTime() >= todayStartMs) {
          answeredToday++
        }
        var mSla = r.getInt('sla_minutes_to_real_reply')
        if (mSla > 0) {
          slaSumMinutes += mSla
          slaCount++
        }
      }
    }

    var avgSlaMinutes = slaCount > 0 ? Math.round(slaSumMinutes / slaCount) : 0

    // Carregar correções já aplicadas para marcar insights como corrigidos
    var correctedMap = {}
    var recentCorrections = []
    try {
      var corrRecords = $app.findRecordsByFilter(
        'ml_question_corrections',
        "status = 'applied'",
        '-applied_at,-created',
        50,
        0,
      )
      for (var cIdx = 0; cIdx < corrRecords.length; cIdx++) {
        var cr = corrRecords[cIdx]
        var crItemId = cr.getString('item_id')
        if (crItemId && !correctedMap[crItemId]) {
          correctedMap[crItemId] = {
            id: cr.id,
            item_id: crItemId,
            applied_at: cr.getString('applied_at'),
            applied_by: cr.getString('applied_by'),
            proposed_text: cr.getString('proposed_text'),
          }
        }
        if (cIdx < 10) {
          recentCorrections.push({
            id: cr.id,
            item_id: crItemId,
            item_title: cr.getString('item_title'),
            item_permalink: cr.getString('item_permalink'),
            applied_at: cr.getString('applied_at'),
            applied_by: cr.getString('applied_by'),
            proposed_text: cr.getString('proposed_text'),
          })
        }
      }
    } catch (corrErr) {
      console.log('[ml_questions_api] Aviso ao carregar ml_question_corrections: ' + corrErr)
    }

    // Carregar templates ativos para sintetizar a proposta rápida já no objeto de cada produto
    var activeTemplates = []
    try {
      activeTemplates = $app.findRecordsByFilter(
        'ml_question_templates',
        'active = true',
        '-times_used,-created',
        50,
        0,
      )
    } catch (_) {}

    var productList = []
    for (var k in productQuestionsMap) {
      var pObj = productQuestionsMap[k]
      pObj.is_corrected = Boolean(correctedMap[pObj.item_id])
      pObj.last_correction = correctedMap[pObj.item_id] || null

      // Buscar estoque real direto de forma rápida
      var pStock = 0
      try {
        var directProds = $app.findRecordsByFilter(
          'products',
          "ml_listing_id = '" + pObj.item_id + "' && status = 'Disponível'",
          '-created',
          100,
          0,
        )
        if (directProds && directProds.length > 0) {
          pStock = directProds.length
        }
      } catch (_) {}
      pObj.matching_stock = pStock

      // Síntese local imediata da proposta de correção
      var pFaqItems = []
      var pQuestionsList = pObj.sample_texts || []
      for (var tIdx = 0; tIdx < activeTemplates.length; tIdx++) {
        var tpl = activeTemplates[tIdx]
        var kwRaw = tpl.get('keywords') || []
        var kws = Array.isArray(kwRaw) ? kwRaw : []
        var tTitle = tpl.getString('title') || ''
        var tContent = tpl.getString('content') || ''

        var matchedQ = []
        for (var qIdx = 0; qIdx < pQuestionsList.length; qIdx++) {
          var qTextLower = String(pQuestionsList[qIdx]).toLowerCase()
          var hasMatch = false
          for (var kwI = 0; kwI < kws.length; kwI++) {
            var kw = String(kws[kwI]).toLowerCase()
            if (kw.length >= 3 && qTextLower.indexOf(kw) !== -1) {
              hasMatch = true
              break
            }
          }
          if (hasMatch) {
            matchedQ.push(pQuestionsList[qIdx])
          }
        }

        if (matchedQ.length > 0) {
          var stockStr = pStock > 0 ? String(pStock) : 'unidades a pronta entrega'
          var cleanContent = tContent
            .replace(/\{estoque_real\}/g, stockStr)
            .replace(/\{saudacao\}\!?\s*/gi, '')
            .replace(/Olá\!\s*/gi, '')
            .replace(/Bom dia\!\s*/gi, '')
            .replace(/Boa tarde\!\s*/gi, '')
            .replace(/Boa noite\!\s*/gi, '')
            .trim()

          pFaqItems.push({
            topic: tTitle,
            answer: cleanContent,
          })
        }
      }

      var pProposedText = ''
      if (pFaqItems.length > 0) {
        var pLines = []
        pLines.push('📌 INFORMAÇÕES FREQUENTES E DÚVIDAS ESCLARECIDAS:')
        for (var pf = 0; pf < pFaqItems.length; pf++) {
          pLines.push('• ' + pFaqItems[pf].topic.toUpperCase() + ': ' + pFaqItems[pf].answer)
        }
        pLines.push(
          '✔ Equipamento revisado com garantia Ambicorp e envio imediato com Nota Fiscal (NF-e).',
        )
        pProposedText = pLines.join('\n')
      } else {
        pProposedText =
          '📌 ESCLARECIMENTOS SOBRE O PRODUTO (Dúvidas frequentes atendidas):\n' +
          '• Compatibilidade e Condição: equipamento testado e revisado em bancada técnica especializada Ambicorp.\n' +
          '• Garantia e Procedência: emitimos Nota Fiscal (NF-e) e oferecemos garantia de 90 dias com suporte direto.\n' +
          '• Envio Rápido: produto em estoque com despacho ágil e embalagem segura via Mercado Envios.'
      }

      pObj.proposed_text = pProposedText
      productList.push(pObj)
    }
    productList.sort(function (a, b) {
      return b.total_questions - a.total_questions
    })

    return e.json(200, {
      ok: true,
      pending_total: pendingUnanswered + waitingRealReply,
      pending_unanswered: pendingUnanswered,
      waiting_real_reply: waitingRealReply,
      critical_count: criticalCount,
      warning_count: warningCount,
      answered_count: answeredCount,
      answered_today: answeredToday,
      avg_sla_minutes: avgSlaMinutes,
      top_products_with_questions: productList.slice(0, 15),
      recent_corrections: recentCorrections,
    })
  },
  $apis.requireAuth(),
)

// 4. ROTA GET /backend/v1/ml/questions/insight-correction/propose
// Retorna a proposta do texto da correção para a descrição do anúncio baseado nas dúvidas e templates
routerAdd(
  'GET',
  '/backend/v1/ml/questions/insight-correction/propose',
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

    var itemId = String(e.requestInfo().query.item_id || '').trim()
    if (!itemId) {
      return e.json(400, { ok: false, error: 'O parâmetro item_id é obrigatório.' })
    }

    // Carregar ml_settings para token
    var sRecords = []
    try {
      sRecords = $app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    } catch (err) {
      console.log('[ml_questions_api] Erro ao carregar ml_settings: ' + err)
    }

    if (!sRecords || sRecords.length === 0) {
      return e.json(400, {
        ok: false,
        error: 'Configurações do Mercado Livre não encontradas no sistema.',
      })
    }

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
          timeout: 20,
        })

        if (refRes.statusCode === 200 && refRes.json) {
          accessToken = refRes.json.access_token || accessToken
          var newRef = refRes.json.refresh_token || refreshToken
          var expIn = Number(refRes.json.expires_in) || 21600
          var newExpDate = new Date(Date.now() + expIn * 1000).toISOString()
          settings.set('access_token', accessToken)
          settings.set('refresh_token', newRef)
          settings.set('token_expires_at', newExpDate)
          $app.save(settings)
        }
      } catch (rErr) {
        console.log('[ml_questions_api] Erro ao renovar token ML: ' + rErr)
      }
    }

    // 1. Buscar perguntas reais deste item no cache
    var questionRecords = []
    try {
      questionRecords = $app.findRecordsByFilter(
        'ml_questions_cache',
        "item_id = '" + itemId + "'",
        '-date_created,-created',
        50,
        0,
      )
    } catch (qErr) {
      console.log('[ml_questions_api] Erro ao buscar perguntas para proposta: ' + qErr)
    }

    var itemTitle = ''
    var itemPermalink = ''
    var questionsList = []
    for (var qi = 0; qi < questionRecords.length; qi++) {
      var qRec = questionRecords[qi]
      if (!itemTitle && qRec.getString('item_title')) {
        itemTitle = qRec.getString('item_title')
      }
      if (!itemPermalink && qRec.getString('item_permalink')) {
        itemPermalink = qRec.getString('item_permalink')
      }
      var t = qRec.getString('text')
      if (t && questionsList.indexOf(t) === -1) {
        questionsList.push(t)
      }
    }

    // 2. Buscar dados do item no ML e estoque no sistema local
    var currentDescription = ''
    var mlItemStatus = 'active'
    if (accessToken && itemId) {
      try {
        var itRes = $http.send({
          url: 'https://api.mercadolibre.com/items/' + encodeURIComponent(itemId),
          method: 'GET',
          headers: {
            Authorization: 'Bearer ' + accessToken,
            Accept: 'application/json',
          },
          timeout: 15,
        })
        if (itRes.statusCode === 200 && itRes.json) {
          if (!itemTitle && itRes.json.title) itemTitle = itRes.json.title
          if (!itemPermalink && itRes.json.permalink) itemPermalink = itRes.json.permalink
          if (itRes.json.status) mlItemStatus = itRes.json.status
        }
      } catch (_) {}

      // Buscar descrição atual do anúncio (GET /items/{id}/description)
      try {
        var descRes = $http.send({
          url: 'https://api.mercadolibre.com/items/' + encodeURIComponent(itemId) + '/description',
          method: 'GET',
          headers: {
            Authorization: 'Bearer ' + accessToken,
            Accept: 'application/json',
          },
          timeout: 15,
        })
        if (descRes.statusCode === 200 && descRes.json) {
          currentDescription = descRes.json.plain_text || descRes.json.text || ''
        }
      } catch (dGetErr) {
        console.log('[ml_questions_api] Aviso ao buscar descrição atual: ' + dGetErr)
      }
    }

    // 3. Buscar estoque real disponível no sistema local
    var matchingStock = 0
    try {
      var directProds = $app.findRecordsByFilter(
        'products',
        "ml_listing_id = '" + itemId + "' && status = 'Disponível'",
        '-created',
        100,
        0,
      )
      if (directProds && directProds.length > 0) {
        matchingStock = directProds.length
      }
    } catch (_) {}

    // 4. Buscar templates disponíveis em ml_question_templates
    var templates = []
    try {
      templates = $app.findRecordsByFilter(
        'ml_question_templates',
        'active = true',
        '-times_used,-created',
        50,
        0,
      )
    } catch (_) {}

    // 5. Motor de Síntese Inteligente da Proposta de Correção
    // Consolida as dúvidas recorrentes num parágrafo de FAQ do Produto
    var faqItems = []
    var matchedTemplatesUsed = []

    for (var tIdx = 0; tIdx < templates.length; tIdx++) {
      var tpl = templates[tIdx]
      var kwRaw = tpl.get('keywords') || []
      var kws = Array.isArray(kwRaw) ? kwRaw : []
      var tTitle = tpl.getString('title') || ''
      var tContent = tpl.getString('content') || ''

      // Verificar se alguma pergunta recebida bate com as keywords do template
      var matchedQuestions = []
      for (var qIdx = 0; qIdx < questionsList.length; qIdx++) {
        var qTextLower = questionsList[qIdx].toLowerCase()
        var hasMatch = false
        for (var k = 0; k < kws.length; k++) {
          var kw = String(kws[k]).toLowerCase()
          if (kw.length >= 3 && qTextLower.indexOf(kw) !== -1) {
            hasMatch = true
            break
          }
        }
        if (hasMatch) {
          matchedQuestions.push(questionsList[qIdx])
        }
      }

      if (matchedQuestions.length > 0) {
        // Formatar o texto do template substituindo variáveis
        var stockStr = matchingStock > 0 ? String(matchingStock) : 'unidades a pronta entrega'
        var cleanContent = tContent
          .replace(/\{estoque_real\}/g, stockStr)
          .replace(/\{saudacao\}\!?\s*/gi, '')
          .replace(/Olá\!\s*/gi, '')
          .replace(/Bom dia\!\s*/gi, '')
          .replace(/Boa tarde\!\s*/gi, '')
          .replace(/Boa noite\!\s*/gi, '')
          .trim()

        faqItems.push({
          topic: tTitle,
          answer: cleanContent,
          questions: matchedQuestions,
        })
        matchedTemplatesUsed.push(tTitle)
      }
    }

    // Construção do parágrafo proposto formatado para a descrição do Mercado Livre
    var proposedParagraph = ''
    if (faqItems.length > 0) {
      var lines = []
      lines.push('📌 INFORMAÇÕES FREQUENTES E DÚVIDAS ESCLARECIDAS:')
      for (var f = 0; f < faqItems.length; f++) {
        var item = faqItems[f]
        lines.push('• ' + item.topic.toUpperCase() + ': ' + item.answer)
      }
      lines.push(
        '✔ Equipamento revisado com garantia Ambicorp e envio imediato com Nota Fiscal (NF-e).',
      )
      proposedParagraph = lines.join('\n')
    } else {
      // Fallback consolidando as perguntas gerais recebidas
      var sampleQ = questionsList.slice(0, 3).join('", "')
      proposedParagraph =
        '📌 ESCLARECIMENTOS SOBRE O PRODUTO (Dúvidas frequentes atendidas):\n' +
        '• Compatibilidade e Condição: equipamento testado e revisado em bancada técnica especializada Ambicorp.\n' +
        '• Garantia e Procedência: emitimos Nota Fiscal (NF-e) e oferecemos garantia de 90 dias com suporte direto.\n' +
        '• Envio Rápido: produto em estoque com despacho ágil e embalagem segura via Mercado Envios.'
    }

    // Visual da descrição concatenada final
    var finalCombined = ''
    if (currentDescription && currentDescription.trim().length > 0) {
      finalCombined = currentDescription.trim() + '\n\n---\n\n' + proposedParagraph.trim()
    } else {
      finalCombined = proposedParagraph.trim()
    }

    // Verificar se já foi corrigido antes
    var alreadyCorrected = false
    var lastCorrectionRecord = null
    try {
      var existCorr = $app.findRecordsByFilter(
        'ml_question_corrections',
        "item_id = '" + itemId + "' && status = 'applied'",
        '-applied_at,-created',
        1,
        0,
      )
      if (existCorr && existCorr.length > 0) {
        alreadyCorrected = true
        lastCorrectionRecord = {
          applied_at: existCorr[0].getString('applied_at'),
          applied_by: existCorr[0].getString('applied_by'),
          proposed_text: existCorr[0].getString('proposed_text'),
        }
      }
    } catch (_) {}

    return e.json(200, {
      ok: true,
      item_id: itemId,
      item_title: itemTitle,
      item_permalink: itemPermalink,
      ml_item_status: mlItemStatus,
      matching_stock: matchingStock,
      total_questions: questionsList.length,
      sample_questions: questionsList.slice(0, 5),
      proposed_text: proposedParagraph,
      current_description: currentDescription,
      final_description_preview: finalCombined,
      already_corrected: alreadyCorrected,
      last_correction: lastCorrectionRecord,
    })
  },
  $apis.requireAuth(),
)

// 5. ROTA POST /backend/v1/ml/questions/insight-correction/apply
// Aplica a correção de 1 clique na API do Mercado Livre (PUT /items/{id}/description)
routerAdd(
  'POST',
  '/backend/v1/ml/questions/insight-correction/apply',
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

    var itemId = String(body.item_id || '').trim()
    var textToAdd = String(body.proposed_text || '').trim()

    if (!itemId) {
      return e.json(400, { ok: false, error: 'O campo item_id é obrigatório.' })
    }
    if (!textToAdd) {
      return e.json(400, {
        ok: false,
        error: 'O texto da correção para adicionar ao anúncio não pode ser vazio.',
      })
    }

    // Carregar ml_settings
    var sRecords = []
    try {
      sRecords = $app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    } catch (err) {
      console.log('[ml_questions_api] Erro ao carregar ml_settings: ' + err)
    }

    if (!sRecords || sRecords.length === 0) {
      return e.json(400, {
        ok: false,
        error: 'Configurações do Mercado Livre não encontradas no sistema.',
      })
    }

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
          timeout: 20,
        })

        if (refRes.statusCode === 200 && refRes.json) {
          accessToken = refRes.json.access_token || accessToken
          var newRef = refRes.json.refresh_token || refreshToken
          var expIn = Number(refRes.json.expires_in) || 21600
          var newExpDate = new Date(Date.now() + expIn * 1000).toISOString()
          settings.set('access_token', accessToken)
          settings.set('refresh_token', newRef)
          settings.set('token_expires_at', newExpDate)
          $app.save(settings)
          console.log('[ml_questions_api] Token renovado com sucesso para aplicação de correção.')
        }
      } catch (rErr) {
        console.log('[ml_questions_api] Erro ao renovar token ML: ' + rErr)
      }
    }

    if (!accessToken) {
      return e.json(400, {
        ok: false,
        error: 'Mercado Livre sem token de acesso ativo ou autenticação expirada.',
      })
    }

    // 1. Obter dados e descrição atual do anúncio no ML
    var itemTitle = ''
    var itemPermalink = ''
    try {
      var itRes = $http.send({
        url: 'https://api.mercadolibre.com/items/' + encodeURIComponent(itemId),
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + accessToken,
          Accept: 'application/json',
        },
        timeout: 15,
      })
      if (itRes.statusCode === 200 && itRes.json) {
        itemTitle = itRes.json.title || ''
        itemPermalink = itRes.json.permalink || ''
      }
    } catch (_) {}

    var previousDescription = ''
    var hadExistingDescription = false
    try {
      var curDescRes = $http.send({
        url: 'https://api.mercadolibre.com/items/' + encodeURIComponent(itemId) + '/description',
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + accessToken,
          Accept: 'application/json',
        },
        timeout: 15,
      })
      if (curDescRes.statusCode === 200 && curDescRes.json) {
        previousDescription = curDescRes.json.plain_text || curDescRes.json.text || ''
        hadExistingDescription = true
      }
    } catch (dGetErr) {
      console.log('[ml_questions_api] Aviso ao buscar descrição anterior: ' + dGetErr)
    }

    // REGRA DE OURO: A API do ML SUBSTITUI a descrição inteira — então CONCATENAMOS ao final com separador visual
    var finalPlainText = ''
    if (previousDescription && previousDescription.trim().length > 0) {
      finalPlainText = previousDescription.trim() + '\n\n---\n\n' + textToAdd.trim()
    } else {
      finalPlainText = textToAdd.trim()
    }

    // 2. Enviar para a API do ML via PUT (ou POST caso ainda não existisse descrição)
    var putUrl = 'https://api.mercadolibre.com/items/' + encodeURIComponent(itemId) + '/description'
    var putRes = null
    var mlError = ''

    // Tentativa com PUT (padrão oficial para atualizar descrição)
    try {
      putRes = $http.send({
        url: putUrl,
        method: 'PUT',
        headers: {
          Authorization: 'Bearer ' + accessToken,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          plain_text: finalPlainText,
        }),
        timeout: 25,
      })
    } catch (netErr) {
      mlError = 'Erro de rede: ' + (netErr.message || netErr)
    }

    // Fallback: se o ML retornar 404 informando que não há descrição prévia criada, usa POST
    if (putRes && putRes.statusCode === 404) {
      try {
        putRes = $http.send({
          url: putUrl,
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + accessToken,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            plain_text: finalPlainText,
          }),
          timeout: 25,
        })
      } catch (pErr) {
        mlError = 'Erro no fallback POST: ' + (pErr.message || pErr)
      }
    }

    var isSuccess = putRes && putRes.statusCode >= 200 && putRes.statusCode < 300
    if (!isSuccess && putRes) {
      var eJson = putRes.json || {}
      mlError =
        eJson.message ||
        eJson.error_description ||
        eJson.error ||
        'Código HTTP ' + putRes.statusCode
    }

    var operatorName =
      authRecord.getString('name') || authRecord.getString('email') || 'Operador Ambicorp'

    // 3. Registrar auditoria em ml_question_corrections
    var auditRec = null
    try {
      var corrCol = $app.findCollectionByNameOrId('ml_question_corrections')
      if (corrCol) {
        auditRec = new Record(corrCol)
        auditRec.set('item_id', itemId)
        auditRec.set('item_title', itemTitle)
        auditRec.set('item_permalink', itemPermalink)
        auditRec.set('proposed_text', textToAdd)
        auditRec.set('previous_description', previousDescription)
        auditRec.set('final_description', finalPlainText)
        auditRec.set('status', isSuccess ? 'applied' : 'failed')
        auditRec.set('applied_by', operatorName)
        auditRec.set('applied_at', new Date().toISOString())
        if (!isSuccess) {
          auditRec.set('error_message', mlError)
        }
        if (putRes && putRes.json) {
          auditRec.set('api_response', putRes.json)
        }
        $app.save(auditRec)
      }
    } catch (audErr) {
      console.log('[ml_questions_api] Aviso ao salvar auditoria de correção: ' + audErr)
    }

    if (!isSuccess) {
      return e.json(putRes ? putRes.statusCode : 502, {
        ok: false,
        error:
          'Não foi possível atualizar a descrição do anúncio no Mercado Livre: ' +
          (mlError || 'Falha de comunicação com o ML.'),
        item_id: itemId,
      })
    }

    return e.json(200, {
      ok: true,
      message: 'Correção aplicada com sucesso na descrição do anúncio do Mercado Livre!',
      item_id: itemId,
      item_title: itemTitle,
      item_permalink: itemPermalink,
      applied_by: operatorName,
      applied_at: new Date().toISOString(),
      final_description: finalPlainText,
      audit_id: auditRec ? auditRec.id : null,
    })
  },
  $apis.requireAuth(),
)
