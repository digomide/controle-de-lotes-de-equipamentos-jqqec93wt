// Hook para geração em massa de Part Numbers Internos (AMB0001, AMB0002, ...)
// Rota: POST /backend/v1/products/bulk-internal-part-numbers
// Processa equipamentos pendentes de ativação em lote com segurança atômica/transacional

routerAdd(
  'POST',
  '/backend/v1/products/bulk-internal-part-numbers',
  (e) => {
    var authRecord = e.auth
    if (!authRecord) {
      try {
        var info = e.requestInfo()
        authRecord = info.auth
      } catch (_) {}
    }

    if (!authRecord || !authRecord.id) {
      return e.json(401, { ok: false, error: 'Sessão não autenticada.' })
    }

    var body = {}
    try {
      body = e.requestInfo().body || {}
    } catch (_) {
      body = {}
    }

    var productIds = body.product_ids || body.productIds || []
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return e.json(400, { ok: false, error: 'Lista de IDs de equipamentos vazia ou inválida.' })
    }

    try {
      var activatedCount = 0
      var ignoredAlreadyActiveCount = 0
      var notFoundCount = 0
      var updatedItems = []

      // Usar transação do PocketBase ($app.runInTransaction) para garantir unicidade e integridade
      $app.runInTransaction((txApp) => {
        // 1. Descobrir o maior número AMB existente no banco de dados
        // Buscar registros onde part_number começa com AMB
        var maxNum = 0
        try {
          var records = txApp.findRecordsByFilter(
            'products',
            "part_number ~ 'AMB'",
            '-created',
            5000,
            0,
          )
          for (var i = 0; i < records.length; i++) {
            var pn = records[i].getString('part_number') || ''
            var match = pn.match(/^AMB(\d{4,})$/)
            if (match && match[1]) {
              var val = parseInt(match[1], 10)
              if (!isNaN(val) && val > maxNum) {
                maxNum = val
              }
            }
          }
        } catch (findErr) {
          console.log('[bulk-internal-pn] Aviso ao buscar PNs existentes: ' + findErr)
        }

        var currentSeq = maxNum

        // Formatar código: AMB + sequencial com no mínimo 4 dígitos (ex: AMB0001, AMB0002, AMB10000)
        function formatAMBCode(num) {
          var s = num.toString()
          while (s.length < 4) {
            s = '0' + s
          }
          return 'AMB' + s
        }

        var nowIso = new Date().toISOString().replace('T', ' ').substring(0, 19)

        for (var j = 0; j < productIds.length; j++) {
          var pId = String(productIds[j]).trim()
          if (!pId) continue

          var prod = null
          try {
            prod = txApp.findRecordById('products', pId)
          } catch (_) {
            notFoundCount++
            continue
          }

          if (!prod) {
            notFoundCount++
            continue
          }

          var existingPn = (prod.getString('part_number') || '').trim()
          var currentStatus = prod.getString('status') || ''

          // Regra: Não sobrescrever PN real nem equipamento já ativado
          // Se já possui PN preenchido ou status diferente de 'Pendente de ativação' (e tem PN), ignorar
          if (existingPn.length > 0 || currentStatus !== 'Pendente de ativação') {
            ignoredAlreadyActiveCount++
            continue
          }

          // Equipamento elegível: gerar próximo código AMB
          currentSeq++
          var newPn = formatAMBCode(currentSeq)

          prod.set('part_number', newPn)
          prod.set('status', 'Disponível')

          // Adicionar evento ao histórico do equipamento
          var events = []
          try {
            var rawEv = prod.get('history_events')
            if (Array.isArray(rawEv)) {
              events = rawEv.slice(0)
            } else if (typeof rawEv === 'string' && rawEv.trim().startsWith('[')) {
              events = JSON.parse(rawEv)
            }
          } catch (_) {
            events = []
          }

          events.push({
            date: nowIso,
            title: 'Ativação em massa: PN interno gerado (' + newPn + ')',
          })
          prod.set('history_events', events)

          txApp.save(prod)

          activatedCount++
          updatedItems.push({
            id: prod.id,
            name: prod.getString('name'),
            part_number: newPn,
            status: 'Disponível',
          })
        }
      })

      return e.json(200, {
        ok: true,
        activatedCount: activatedCount,
        ignoredAlreadyActiveCount: ignoredAlreadyActiveCount,
        notFoundCount: notFoundCount,
        totalRequested: productIds.length,
        items: updatedItems,
      })
    } catch (err) {
      console.log('[bulk-internal-pn] Erro durante processamento em lote: ' + err)
      return e.json(500, {
        ok: false,
        error: 'Erro no processamento em lote de PNs: ' + (err.message || err),
      })
    }
  },
  $apis.requireAuth(),
)
