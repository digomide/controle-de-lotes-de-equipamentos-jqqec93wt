// Hook de Servidor para Emissão e Gestão de Notas Fiscais via Focus NFe
// Rotas registradas:
// 1. POST /backend/v1/nf/emit — Transmissão ou Simulação de emissão de NF-e para a Focus NFe
// 2. GET /backend/v1/nf/status — Consulta status de uma nota fiscal na Focus NFe pelo ref
// 3. POST /backend/v1/nf/sync-certificate — Upload e configuração do certificado digital A1 na Focus NFe
//
// Documentação de referência: https://doc.focusnfe.com.br/reference/emitir_nfe.md

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
      return e.json(401, { ok: false, error: 'Sessão não autenticada.' })
    }

    var body = {}
    try {
      body = e.requestInfo().body || {}
    } catch (_) {
      body = {}
    }

    // 1. Carregar configuração ativa do emissor em nf_config
    var configRecords = []
    try {
      configRecords = $app.findRecordsByFilter('nf_config', '1=1', '-created', 1, 0)
    } catch (errCfg) {
      console.log('[nf_emit] Erro ao buscar nf_config: ' + errCfg)
    }

    var config = configRecords && configRecords.length > 0 ? configRecords[0] : null
    var focusToken = config ? (config.getString('focus_token') || '').trim() : ''

    // Se o token Focus ou a configuração não existir, retornar o erro amigável solicitado
    if (!focusToken) {
      return e.json(400, {
        ok: false,
        error_code: 'CONFIG_MISSING',
        error:
          'Configure o emissor em Configurações → Notas Fiscais para habilitar a transmissão de NF-e.',
      })
    }

    // 2. Obter dados enviados na requisição de emissão
    var originType = body.origin_type || 'manual' // 'ml_order' | 'sale_internal' | 'manual'
    var mlOrderId = body.ml_order_id || ''
    var saleId = body.sale_id || ''
    var destinatario = body.destinatario || {}
    var itens = Array.isArray(body.itens) ? body.itens : []
    var naturezaOperacao = (
      body.natureza_operacao ||
      config.getString('natureza_operacao_padrao') ||
      'VENDA DE MERCADORIA USADA'
    ).trim()
    var informacoesComplementares = (
      body.informacoes_complementares ||
      config.getString('informacoes_complementares_padrao') ||
      ''
    ).trim()

    if (!itens || itens.length === 0) {
      return e.json(400, { ok: false, error: 'A nota fiscal deve conter pelo menos 1 item.' })
    }

    // Validação básica do destinatário
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
      var cfop = (
        item.cfop ||
        (destinatario.uf && destinatario.uf !== config.getString('uf')
          ? config.getString('default_cfop_interestadual')
          : config.getString('default_cfop_estadual')) ||
        '5108'
      ).trim()
      var csosn = (item.csosn || config.getString('default_csosn') || '102').trim()

      focusItens.push({
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
        origem: 0, // 0 - Nacional
        icms_situacao_tributaria: csosn,
      })
    }

    // 5. Montar payload completo Focus NFe
    var environment = config.getString('environment') || 'homologacao'
    var baseUrl =
      environment === 'producao'
        ? 'https://api.focusnfe.com.br'
        : 'https://homologacao.focusnfe.com.br'

    var focusPayload = {
      natureza_operacao: naturezaOperacao,
      data_emissao: new Date().toISOString(),
      tipo_documento: 1, // 1 - Saída
      finalidade_emissao: 1, // 1 - Normal
      consumidor_final: 1, // 1 - Consumidor final
      presenca_comprador: originType === 'ml_order' ? 2 : 1, // 2 - Não presencial (Internet), 1 - Presencial
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
          forma_pagamento: originType === 'ml_order' ? '17' : '01', // 17 = Pagamento Instantâneo (PIX) / Mercado Pago, 01 = Dinheiro
          valor_pagamento: valorTotal,
        },
      ],
    }

    if (docDest.length === 11) {
      focusPayload.destinatario.cpf = docDest
    } else {
      focusPayload.destinatario.cnpj = docDest
    }

    // 6. Criar ou atualizar registro em nf_invoices (status: processando)
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
    invoiceRecord.set('created_by', authRecord.id)

    $app.save(invoiceRecord)

    // 7. Transmissão para a API da Focus NFe via HTTP Basic Auth (token no username, senha vazia)
    var focusEndpoint = baseUrl + '/v2/nfe?ref=' + encodeURIComponent(ref)
    console.log('[nf_emit] Enviando NFe para Focus: ' + focusEndpoint)

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

      // Análise do retorno da Focus NFe
      // Status possíveis da Focus: 'processando_autorizacao', 'autorizado', 'erro_autorizacao', 'cancelado'
      var focusStatus = resData.status || ''
      var sefazStatus = resData.status_sefaz || ''
      var sefazMensagem = resData.mensagem_sefaz || resData.mensagem || resData.erros || ''

      if (typeof sefazMensagem === 'object') {
        sefazMensagem = JSON.stringify(sefazMensagem)
      }

      if (focusStatus === 'autorizado') {
        invoiceRecord.set('status', 'autorizada')
        invoiceRecord.set('numero', String(resData.numero || ''))
        invoiceRecord.set('serie', String(resData.serie || ''))
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

        // Se for pedido do Mercado Livre, limpar invoice_pending do pedido para sumir o alerta
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
        chave_nfe: inv.getString('chave_nfe'),
        caminho_danfe: inv.getString('caminho_danfe'),
        caminho_xml: inv.getString('caminho_xml_nota_fiscal'),
        mensagem: inv.getString('mensagem_sefaz'),
      })
    }

    // Se estiver processando, consulta a Focus NFe
    var configRecords = $app.findRecordsByFilter('nf_config', '1=1', '-created', 1, 0)
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
        inv.set('numero', String(data.numero || ''))
        inv.set('serie', String(data.serie || ''))
        inv.set('chave_nfe', String(data.chave_nfe || ''))
        inv.set('protocolo_autorizacao', String(data.protocolo_autorizacao || ''))
        inv.set('caminho_danfe', data.caminho_danfe ? baseUrl + data.caminho_danfe : '')
        inv.set(
          'caminho_xml_nota_fiscal',
          data.caminho_xml_nota_fiscal ? baseUrl + data.caminho_xml_nota_fiscal : '',
        )
        inv.set('status_sefaz', sefazStatus)
        inv.set('mensagem_sefaz', sefazMensagem || 'Autorizada com sucesso')

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
