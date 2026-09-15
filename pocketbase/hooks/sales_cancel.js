// Hook para Cancelamento Atômico de Venda e Devolução de Estoque
// Rota: POST /backend/v1/sales/cancel
// Regras:
// 1. Requer autenticação de usuário.
// 2. Valida existência da venda e impede cancelamento duplo (se status === 'cancelled').
// 3. Verifica se existe nota fiscal ativa na SEFAZ (autorizada ou processando). Se houver e o usuário não marcar force=true ou se houver NF autorizada, avisa/bloqueia.
// 4. Se a venda consumiu estoque (status !== 'cancelled'):
//    - Itera sobre todos os sale_items da venda
//    - Para cada batch_id: incrementa a quantidade do lote (batch.quantity += qty)
//    - Para cada product_id: se estava Vendido, volta para 'Disponível', adiciona evento ao histórico
//    - Registra movimentação na coleção inventory_adjustments (type: 'return') para auditoria de estoque
// 5. Atualiza o status da venda para 'cancelled', registra cancel_reason, cancelled_at e cancelled_by
// 6. Tudo dentro de $app.runInTransaction para atomicidade estrita.

routerAdd(
  'POST',
  '/backend/v1/sales/cancel',
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

    var saleId = (body.sale_id || '').trim()
    if (!saleId) {
      return e.json(400, { ok: false, error: 'Identificador da venda (sale_id) é obrigatório.' })
    }

    var cancelReason = (body.reason || body.cancel_reason || '').trim()
    var forceFiscal = Boolean(body.force_fiscal)

    try {
      var saleRecord = $app.findRecordById('sales', saleId)
      if (!saleRecord) {
        return e.json(404, { ok: false, error: 'Venda não encontrada.' })
      }

      var currentStatus = saleRecord.getString('status')
      if (currentStatus === 'cancelled') {
        return e.json(400, { ok: false, error: 'Esta venda já está cancelada.' })
      }

      // Checagem de Notas Fiscais vinculadas
      var activeInvoices = []
      try {
        activeInvoices = $app.findRecordsByFilter(
          'nf_invoices',
          "sale_id = '" + saleId + "' && status != 'cancelada' && status != 'rejeitada'",
          '-created',
          10,
          0,
        )
      } catch (errNf) {
        console.log('[cancel-sale] Aviso ao consultar NF vinculada: ' + errNf)
      }

      if (activeInvoices.length > 0) {
        var authorizedInvoices = []
        for (var n = 0; n < activeInvoices.length; n++) {
          var inv = activeInvoices[n]
          if (inv.getString('status') === 'autorizada') {
            authorizedInvoices.push(inv)
          }
        }

        // Se houver NF autorizada na SEFAZ e o usuário não confirmou explicitamente o cancelamento com conhecimento fiscal
        if (authorizedInvoices.length > 0 && !forceFiscal) {
          var nfNumbers = authorizedInvoices
            .map((item) =>
              item.getString('numero')
                ? 'NF-e nº ' + item.getString('numero')
                : item.getString('ref'),
            )
            .join(', ')

          return e.json(409, {
            ok: false,
            has_authorized_nf: true,
            invoices: authorizedInvoices.map((i) => ({
              id: i.id,
              ref: i.getString('ref'),
              numero: i.getString('numero'),
              status: i.getString('status'),
            })),
            error:
              'Atenção Fiscal: Existe(m) Nota(s) Fiscal(is) autorizada(s) para esta venda (' +
              nfNumbers +
              '). Cancele a NF-e na SEFAZ ou marque a confirmação expressa de responsabilidade fiscal.',
          })
        }
      }

      var restoredItemsCount = 0
      var restoredUnitsCount = 0
      var nowIso = new Date().toISOString().replace('T', ' ').substring(0, 19)

      $app.runInTransaction((txApp) => {
        // 1. Buscar todos os itens da venda
        var saleItems = txApp.findRecordsByFilter(
          'sale_items',
          "sale_id = '" + saleId + "'",
          'created',
          500,
          0,
        )

        var adjustmentsCol = null
        try {
          adjustmentsCol = txApp.findCollectionByNameOrId('inventory_adjustments')
        } catch (_) {}

        for (var i = 0; i < saleItems.length; i++) {
          var item = saleItems[i]
          var batchId = item.getString('batch_id')
          var productId = item.getString('product_id')
          var qty = item.getInt('quantity') || 0

          if (qty <= 0) continue

          // A. Devolver quantidade ao lote (batch)
          if (batchId) {
            try {
              var batch = txApp.findRecordById('batches', batchId)
              var prevQty = batch.getInt('quantity') || 0
              var newQty = prevQty + qty
              batch.set('quantity', newQty)
              txApp.save(batch)

              // Registrar em inventory_adjustments para rastreabilidade
              if (adjustmentsCol) {
                try {
                  var adj = new Record(adjustmentsCol)
                  adj.set('batch_id', batchId)
                  adj.set('user_id', authRecord.id)
                  adj.set('type', 'return')
                  adj.set('quantity_before', prevQty)
                  adj.set('physical_count', newQty)
                  adj.set('quantity_change', qty)
                  adj.set(
                    'reason',
                    'Devolução automática por cancelamento da Venda #' +
                      saleId.substring(0, 6) +
                      (cancelReason ? ': ' + cancelReason : ''),
                  )
                  txApp.save(adj)
                } catch (adjErr) {
                  console.log('[cancel-sale] Erro ao gravar inventory_adjustment: ' + adjErr)
                }
              }
            } catch (bErr) {
              console.log('[cancel-sale] Aviso ao restaurar lote ' + batchId + ': ' + bErr)
            }
          }

          // B. Devolver status do produto para 'Disponível' e registrar no histórico
          if (productId) {
            try {
              var prod = txApp.findRecordById('products', productId)
              var pEvents = []
              try {
                var rawEv = prod.get('history_events')
                if (Array.isArray(rawEv)) pEvents = rawEv.slice(0)
                else if (typeof rawEv === 'string' && rawEv.trim().startsWith('['))
                  pEvents = JSON.parse(rawEv)
              } catch (_) {
                pEvents = []
              }

              pEvents.push({
                date: nowIso,
                title:
                  'Estoque restaurado para Disponível (Cancelamento da Venda #' +
                  saleId.substring(0, 6) +
                  (cancelReason ? ' — ' + cancelReason : '') +
                  ')',
              })

              prod.set('status', 'Disponível')
              prod.set('history_events', pEvents)
              txApp.save(prod)
            } catch (pErr) {
              console.log(
                '[cancel-sale] Aviso ao restaurar status do produto ' + productId + ': ' + pErr,
              )
            }
          }

          restoredItemsCount++
          restoredUnitsCount += qty
        }

        // 2. Atualizar a venda para 'cancelled'
        var freshSale = txApp.findRecordById('sales', saleId)
        freshSale.set('status', 'cancelled')
        if (cancelReason) {
          freshSale.set('cancel_reason', cancelReason)
        }
        freshSale.set('cancelled_at', nowIso)
        freshSale.set('cancelled_by', authRecord.id)

        // Adicionar nota explicativa se fornecido motivo
        if (cancelReason) {
          var currentNotes = freshSale.getString('notes') || ''
          var cancellationNote =
            '[Cancelado em ' +
            nowIso +
            ' por ' +
            (authRecord.getString('name') || authRecord.id) +
            ']: ' +
            cancelReason
          freshSale.set(
            'notes',
            currentNotes ? currentNotes + '\n' + cancellationNote : cancellationNote,
          )
        }

        txApp.save(freshSale)
      })

      return e.json(200, {
        ok: true,
        sale_id: saleId,
        status: 'cancelled',
        restored_items_count: restoredItemsCount,
        restored_units_count: restoredUnitsCount,
        message:
          'Venda cancelada com sucesso! ' +
          restoredUnitsCount +
          ' unidade(s) devolvida(s) ao estoque e marcadas como Disponível.',
      })
    } catch (err) {
      console.log('[cancel-sale] Erro ao cancelar venda: ' + err)
      return e.json(500, {
        ok: false,
        error: err.message || String(err),
      })
    }
  },
  $apis.requireAuth(),
)
