/// <reference path="../pb_data/types.d.ts" />

/**
 * Hook de Emissão e Consulta de NF-e via Focus NFe API
 * Rota POST: /backend/v1/nf/emit
 * Rota GET:  /backend/v1/nf/status/:ref
 *
 * Suporte a:
 * - Séries dedicadas (ex: Série 2 para não colidir com o Bling na Série 1)
 * - Próximo número sequencial com incremento automático após autorização
 * - Regimes tributários: Simples Nacional (CSOSN), Lucro Presumido e Lucro Real (CST ICMS/PIS/COFINS/IPI)
 * - Origem e regras dinâmicas por categoria de produto
 */

routerAdd(
  'POST',
  '/backend/v1/nf/emit',
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

    // Validação de permissão de módulo (notas_fiscais ou admin)
    var role = authRecord.getString ? authRecord.getString('role') : authRecord.role
    var email = (
      authRecord.getString ? authRecord.getString('email') : authRecord.email || ''
    ).toLowerCase()
    var isAdmin =
      role === 'admin' || email === 'rodrigoifgx@gmail.com' || email.indexOf('gomide') !== -1

    if (!isAdmin) {
      var hasAccess = false
      try {
        var accessRec = $app.findFirstRecordByFilter(
          'user_module_access',
          "user_id = '" + authRecord.id + "'",
        )
        if (accessRec) {
          var mods = accessRec.get('modules') || []
          var modsList = Array.isArray(mods) ? mods : JSON.parse(mods || '[]')
          if (modsList.indexOf('notas_fiscais') !== -1) {
            hasAccess = true
          }
        }
      } catch (_) {}

      if (!hasAccess) {
        return e.json(403, {
          ok: false,
          error:
            'Acesso negado: seu usuário não possui permissão para o módulo de Notas Fiscais (notas_fiscais).',
        })
      }
    }

    var body = e.requestInfo().body || {}
    var originType = body.origin_type || 'manual'
    var mlOrderId = body.ml_order_id || ''
    var saleId = body.sale_id || ''
    var destinatario = body.destinatario || {}
    var itens = body.itens || []
    var naturezaOperacao = body.natureza_operacao || 'Venda de Mercadorias'
    var informacoesComplementares = body.informacoes_complementares || ''

    if (!itens || itens.length === 0) {
      return e.json(400, { ok: false, error: 'Nenhum item informado na nota fiscal.' })
    }

    // 1. Obter configuração do emissor (nf_config)
    var configRecords = []
    try {
      configRecords = $app.findRecordsByFilter('nf_config', '1=1', '', 1, 0)
    } catch (errCfg) {
      console.log('[nf_emit] Erro ao buscar nf_config com sort vazio: ' + errCfg)
      try {
        configRecords = $app.findRecordsByFilter('nf_config', '1=1', '-created', 1, 0)
      } catch (errCfg2) {
        console.log('[nf_emit] Erro no fallback de nf_config: ' + errCfg2)
      }
    }

    // Fallback caso findRecordsByFilter falhe ou venha vazio: tentar findRecordById com ID conhecido ou busca direta
    if (!configRecords || configRecords.length === 0) {
      try {
        var directRec = $app.findRecordById('nf_config', 'febicvnoy5756vb')
        if (directRec) {
          configRecords = [directRec]
        }
      } catch (_) {}
    }

    if (!configRecords || configRecords.length === 0) {
      return e.json(400, {
        ok: false,
        error:
          'Emissor próprio não configurado. Acesse Configurações → Notas Fiscais para configurar o token da Focus NFe e dados da empresa.',
      })
    }

    var config = configRecords[0]
    var focusToken = (config.getString('focus_token') || '').trim()

    if (!focusToken) {
      return e.json(400, {
        ok: false,
        error: 'Token da Focus NFe não preenchido nas configurações. Transmissão SEFAZ bloqueada.',
      })
    }

    // Configurações fiscais da empresa
    var serieNfe = (config.getString('serie_nfe') || '2').trim()
    var proximoNumero = config.getInt('proximo_numero_nfe') || 1
    var regimeTributario = config.getString('regime_tributario') || '1' // '1' = Simples Nacional, '2' = Presumido, '3' = Real

    // 2. Validação do destinatário
    var docDest = (destinatario.cpf || destinatario.cnpj || destinatario.documento || '').replace(
      /\D/g,
      '',
    )

    var nomeDest = (
      destinatario.nome_completo ||
      destinatario.razao_social ||
      destinatario.nome ||
      ''
    ).trim()

    if (!nomeDest) {
      return e.json(400, { ok: false, error: 'Nome/Razão Social do destinatário é obrigatório.' })
    }

    if (!docDest || (docDest.length !== 11 && docDest.length !== 14)) {
      return e.json(400, {
        ok: false,
        error: 'CPF (11 dígitos) ou CNPJ (14 dígitos) do destinatário inválido.',
      })
    }

    // 3. Montar referência única da nota (ref)
    var ref = body.ref || 'NF_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)

    // 4. Calcular totais e montar array de itens no formato Focus NFe
    var valorTotal = 0
    var focusItens = []

    for (var i = 0; i < itens.length; i++) {
      var item = itens[i]
      var qtd = parseFloat(item.quantidade) || 1
      var vUnit = parseFloat(item.valor_unitario) || 0
      var subtotal = parseFloat(item.valor_total) || qtd * vUnit
      valorTotal += subtotal

      var ncm = (item.ncm || config.getString('default_ncm') || '84713012').replace(/\D/g, '')
      var cest = (item.cest || '').replace(/\D/g, '')
      var cfop = (
        item.cfop ||
        (destinatario.uf && destinatario.uf !== config.getString('uf')
          ? config.getString('default_cfop_interestadual')
          : config.getString('default_cfop_estadual')) ||
        '5405'
      ).trim()

      var csosn = (item.csosn || config.getString('default_csosn') || '500').trim()
      var cstIcms = (item.cst_icms || '').trim()
      var origemItem = typeof item.origem === 'number' ? item.origem : 0

      var itemPayload = {
        numero_item: i + 1,
        codigo_produto: item.codigo_produto || item.sku || 'PROD-' + (i + 1),
        descricao: item.descricao || 'Notebook Usado',
        codigo_ncm: ncm,
        cfop: cfop,
        unidade_comercial: 'UN',
        quantidade_comercial: qtd,
        valor_unitario_comercial: vUnit,
        valor_bruto: subtotal,
        unidade_tributavel: 'UN',
        quantidade_tributavel: qtd,
        valor_unitario_tributavel: vUnit,
        origem: origemItem,
      }

      if (cest) {
        itemPayload.codigo_cest = cest
      }

      // Tratamento conforme Regime Tributário: Simples Nacional vs Regime Normal
      if (regimeTributario === '1') {
        // Simples Nacional: usa CSOSN
        itemPayload.icms_situacao_tributaria = csosn
      } else {
        // Lucro Presumido ou Real: usa CST ICMS + PIS/COFINS
        itemPayload.icms_situacao_tributaria = cstIcms || '00'
        if (item.pis_cst) {
          itemPayload.pis_situacao_tributaria = item.pis_cst
        }
        if (item.cofins_cst) {
          itemPayload.cofins_situacao_tributaria = item.cofins_cst
        }
      }

      focusItens.push(itemPayload)
    }

    // 5. Montar payload completo Focus NFe com Série e Número configurados
    var environment = config.getString('environment') || 'homologacao'
    var baseUrl =
      environment === 'producao'
        ? 'https://api.focusnfe.com.br'
        : 'https://homologacao.focusnfe.com.br'

    var focusPayload = {
      natureza_operacao: naturezaOperacao,
      data_emissao: new Date().toISOString(),
      serie: serieNfe,
      numero: proximoNumero,
      tipo_documento: 1, // 1 - Saída
      finalidade_emissao: 1, // 1 - Normal
      consumidor_final: 1, // 1 - Consumidor final
      presenca_comprador: originType === 'ml_order' ? 2 : 1, // 2 - Internet / 1 - Presencial
      informacoes_adicionais_contribuinte: informacoesComplementares,
      itens: focusItens,
      destinatario: {
        nome_completo: nomeDest,
        logradouro: destinatario.logradouro || destinatario.rua || 'Rua',
        numero: destinatario.numero || 'S/N',
        complemento: destinatario.complemento || '',
        bairro: destinatario.bairro || 'Centro',
        municipio: destinatario.municipio || destinatario.cidade || '',
        uf: destinatario.uf || destinatario.estado || 'SP',
        cep: (destinatario.cep || '').replace(/\D/g, ''),
        indicador_inscricao_estadual: 9, // Não contribuinte
      },
      formas_pagamento: [
        {
          forma_pagamento: originType === 'ml_order' ? '17' : '01', // 17 = PIX / Mercado Pago
          valor_pagamento: valorTotal,
        },
      ],
    }

    if (docDest.length === 11) {
      focusPayload.destinatario.cpf = docDest
    } else {
      focusPayload.destinatario.cnpj = docDest
    }

    // 6. Criar registro em nf_invoices (status: processando)
    var invoiceCol = $app.findCollectionByNameOrId('nf_invoices')
    var invoiceRecord = new Record(invoiceCol)
    invoiceRecord.set('ref', ref)
    invoiceRecord.set('origin_type', originType)
    invoiceRecord.set('ml_order_id', mlOrderId)
    invoiceRecord.set('sale_id', saleId)
    invoiceRecord.set('status', 'processando')
    invoiceRecord.set('natureza_operacao', naturezaOperacao)
    invoiceRecord.set('valor_total', valorTotal)
    invoiceRecord.set('destinatario', destinatario)
    invoiceRecord.set('itens', itens)
    invoiceRecord.set('informacoes_complementares', informacoesComplementares)
    invoiceRecord.set('focus_payload', focusPayload)
    invoiceRecord.set('serie', serieNfe)
    invoiceRecord.set('numero', String(proximoNumero))
    invoiceRecord.set('created_by', authRecord.id)

    $app.save(invoiceRecord)

    // 7. Transmissão para a API da Focus NFe
    var focusEndpoint = baseUrl + '/v2/nfe?ref=' + encodeURIComponent(ref)
    console.log(
      '[nf_emit] Enviando NFe Série ' +
        serieNfe +
        ' Nº ' +
        proximoNumero +
        ' para Focus: ' +
        focusEndpoint,
    )

    try {
      var authHeader = 'Basic ' + $security.base64Encode(focusToken + ':')
      var res = $http.send({
        url: focusEndpoint,
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(focusPayload),
        timeout: 45,
      })

      console.log('[nf_emit] Resposta HTTP ' + res.statusCode + ' da Focus NFe')
      var resData = res.json || {}
      invoiceRecord.set('focus_response', resData)

      var focusStatus = resData.status || ''
      var sefazStatus = resData.status_sefaz || ''
      var sefazMensagem = resData.mensagem_sefaz || resData.mensagem || resData.erros || ''

      if (typeof sefazMensagem === 'object') {
        sefazMensagem = JSON.stringify(sefazMensagem)
      }

      if (focusStatus === 'autorizado') {
        invoiceRecord.set('status', 'autorizada')
        invoiceRecord.set('numero', String(resData.numero || proximoNumero))
        invoiceRecord.set('serie', String(resData.serie || serieNfe))
        invoiceRecord.set('chave_nfe', String(resData.chave_nfe || ''))
        invoiceRecord.set('protocolo_autorizacao', String(resData.protocolo_autorizacao || ''))
        invoiceRecord.set(
          'caminho_danfe',
          resData.caminho_danfe ? baseUrl + resData.caminho_danfe : '',
        )
        invoiceRecord.set(
          'caminho_xml_nota_fiscal',
          resData.caminho_xml_nota_fiscal ? baseUrl + resData.caminho_xml_nota_fiscal : '',
        )
        invoiceRecord.set('status_sefaz', sefazStatus)
        invoiceRecord.set('mensagem_sefaz', sefazMensagem || 'Autorizada com sucesso')

        // Incremento automático do próximo número da NF-e
        try {
          config.set('proximo_numero_nfe', proximoNumero + 1)
          $app.save(config)
          console.log(
            '[nf_emit] Contador proximo_numero_nfe incrementado para ' + (proximoNumero + 1),
          )
        } catch (errInc) {
          console.log('[nf_emit] Erro ao incrementar proximo_numero_nfe: ' + errInc)
        }

        // Se for pedido do Mercado Livre, limpar invoice_pending do pedido
        if (mlOrderId) {
          try {
            var mlOrders = $app.findRecordsByFilter(
              'ml_orders',
              "order_id = '" + mlOrderId + "'",
              '',
              1,
              0,
            )
            if (mlOrders.length > 0) {
              var mlOrder = mlOrders[0]
              if (mlOrder.getString('shipping_substatus') === 'invoice_pending') {
                mlOrder.set('shipping_substatus', 'ready_to_print')
              }
              $app.save(mlOrder)
              console.log(
                '[nf_emit] Pedido ML #' + mlOrderId + ' atualizado: invoice_pending removido.',
              )
            }
          } catch (errML) {
            console.log('[nf_emit] Aviso ao desmarcar invoice_pending no pedido ML: ' + errML)
          }
        }
      } else if (focusStatus === 'erro_autorizacao' || res.statusCode >= 400) {
        invoiceRecord.set('status', 'rejeitada')
        invoiceRecord.set('status_sefaz', sefazStatus)
        invoiceRecord.set(
          'mensagem_sefaz',
          sefazMensagem || 'Nota rejeitada pela SEFAZ ou erro no cadastro.',
        )
      } else {
        // 'processando_autorizacao'
        invoiceRecord.set('status', 'processando')
        invoiceRecord.set('status_sefaz', sefazStatus)
        invoiceRecord.set('mensagem_sefaz', sefazMensagem || 'Aguardando retorno da SEFAZ.')
      }

      $app.save(invoiceRecord)

      return e.json(200, {
        ok: true,
        invoice_id: invoiceRecord.id,
        ref: ref,
        status: invoiceRecord.getString('status'),
        mensagem: invoiceRecord.getString('mensagem_sefaz'),
        chave_nfe: invoiceRecord.getString('chave_nfe'),
        numero: invoiceRecord.getString('numero'),
        serie: invoiceRecord.getString('serie'),
        caminho_danfe: invoiceRecord.getString('caminho_danfe'),
      })
    } catch (errHttp) {
      console.log('[nf_emit] Erro na transmissão HTTP Focus: ' + errHttp)
      invoiceRecord.set('status', 'erro_transmissao')
      invoiceRecord.set('mensagem_sefaz', 'Erro ao conectar à API da Focus NFe: ' + errHttp.message)
      $app.save(invoiceRecord)

      return e.json(500, {
        ok: false,
        error:
          'Falha na comunicação com o servidor da Focus NFe: ' +
          (errHttp.message || String(errHttp)),
        invoice_id: invoiceRecord.id,
      })
    }
  },
  $apis.requireAuth(),
)

// Rota de Consulta de Status da NF-e
routerAdd(
  'GET',
  '/backend/v1/nf/status/{ref}',
  (e) => {
    var ref = e.request.pathValue('ref')
    if (!ref) {
      return e.json(400, { ok: false, error: 'Referência (ref) é obrigatória.' })
    }

    var invoiceRecords = []
    try {
      invoiceRecords = $app.findRecordsByFilter('nf_invoices', "ref = '" + ref + "'", '', 1, 0)
    } catch (_) {}

    if (invoiceRecords.length === 0) {
      return e.json(404, { ok: false, error: 'Nota fiscal não encontrada.' })
    }

    var inv = invoiceRecords[0]

    // Se já estiver autorizada ou cancelada, retorna direto
    if (inv.getString('status') === 'autorizada' || inv.getString('status') === 'cancelada') {
      return e.json(200, {
        ok: true,
        status: inv.getString('status'),
        numero: inv.getString('numero'),
        serie: inv.getString('serie'),
        chave_nfe: inv.getString('chave_nfe'),
        caminho_danfe: inv.getString('caminho_danfe'),
        caminho_xml: inv.getString('caminho_xml_nota_fiscal'),
        mensagem: inv.getString('mensagem_sefaz'),
      })
    }

    // Se estiver processando, consulta a Focus NFe
    var configRecords = []
    try {
      configRecords = $app.findRecordsByFilter('nf_config', '1=1', '', 1, 0)
    } catch (_) {
      try {
        configRecords = $app.findRecordsByFilter('nf_config', '1=1', '-created', 1, 0)
      } catch (_) {}
    }
    if (!configRecords || configRecords.length === 0) {
      try {
        var directRec = $app.findRecordById('nf_config', 'febicvnoy5756vb')
        if (directRec) configRecords = [directRec]
      } catch (_) {}
    }
    var config = configRecords && configRecords.length > 0 ? configRecords[0] : null
    var focusToken = config ? (config.getString('focus_token') || '').trim() : ''

    if (!focusToken) {
      return e.json(200, {
        ok: true,
        status: inv.getString('status'),
        mensagem: inv.getString('mensagem_sefaz'),
      })
    }

    var environment = config.getString('environment') || 'homologacao'
    var baseUrl =
      environment === 'producao'
        ? 'https://api.focusnfe.com.br'
        : 'https://homologacao.focusnfe.com.br'
    var consultUrl = baseUrl + '/v2/nfe/' + encodeURIComponent(ref) + '?completa=1'

    try {
      var authHeader = 'Basic ' + $security.base64Encode(focusToken + ':')
      var res = $http.send({
        url: consultUrl,
        method: 'GET',
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
        },
        timeout: 30,
      })

      var data = res.json || {}
      inv.set('focus_response', data)

      var focusStatus = data.status || ''
      var sefazStatus = data.status_sefaz || ''
      var sefazMensagem = data.mensagem_sefaz || data.mensagem || ''

      if (focusStatus === 'autorizado') {
        inv.set('status', 'autorizada')
        inv.set('numero', String(data.numero || inv.getString('numero') || ''))
        inv.set('serie', String(data.serie || inv.getString('serie') || ''))
        inv.set('chave_nfe', String(data.chave_nfe || ''))
        inv.set('protocolo_autorizacao', String(data.protocolo_autorizacao || ''))
        inv.set('caminho_danfe', data.caminho_danfe ? baseUrl + data.caminho_danfe : '')
        inv.set(
          'caminho_xml_nota_fiscal',
          data.caminho_xml_nota_fiscal ? baseUrl + data.caminho_xml_nota_fiscal : '',
        )
        inv.set('status_sefaz', sefazStatus)
        inv.set('mensagem_sefaz', sefazMensagem || 'Autorizada com sucesso')

        // Incremento automático do contador caso tenha sido autorizada assincronamente
        try {
          var currNum = config.getInt('proximo_numero_nfe') || 1
          var notaNum = parseInt(data.numero, 10)
          if (notaNum && notaNum >= currNum) {
            config.set('proximo_numero_nfe', notaNum + 1)
            $app.save(config)
          }
        } catch (_) {}

        var mlId = inv.getString('ml_order_id')
        if (mlId) {
          try {
            var mlOrders = $app.findRecordsByFilter(
              'ml_orders',
              "order_id = '" + mlId + "'",
              '',
              1,
              0,
            )
            if (mlOrders.length > 0) {
              var mlO = mlOrders[0]
              if (mlO.getString('shipping_substatus') === 'invoice_pending') {
                mlO.set('shipping_substatus', 'ready_to_print')
                $app.save(mlO)
              }
            }
          } catch (_) {}
        }
      } else if (focusStatus === 'erro_autorizacao') {
        inv.set('status', 'rejeitada')
        inv.set('status_sefaz', sefazStatus)
        inv.set('mensagem_sefaz', sefazMensagem || 'Rejeitada pela SEFAZ.')
      }

      $app.save(inv)

      return e.json(200, {
        ok: true,
        status: inv.getString('status'),
        numero: inv.getString('numero'),
        serie: inv.getString('serie'),
        chave_nfe: inv.getString('chave_nfe'),
        caminho_danfe: inv.getString('caminho_danfe'),
        caminho_xml: inv.getString('caminho_xml_nota_fiscal'),
        mensagem: inv.getString('mensagem_sefaz'),
      })
    } catch (errCheck) {
      return e.json(200, {
        ok: true,
        status: inv.getString('status'),
        mensagem: 'Erro ao consultar Focus: ' + errCheck.message,
      })
    }
  },
  $apis.requireAuth(),
)
