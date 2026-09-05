// Endpoint para criar preferência no Checkout Pro do Mercado Pago
// Route: POST /api/store/mp/create-preference
// Público (chamado pela loja pública ao iniciar compra)

routerAdd('POST', '/api/store/mp/create-preference', (e) => {
  let body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (_) {
    body = {}
  }

  const orderId = (body.order_id || '').trim()
  const returnBaseUrl = (body.return_url || '').trim()

  if (!orderId) {
    return e.json(400, {
      ok: false,
      error: 'ID do pedido (order_id) é obrigatório.',
    })
  }

  // 1. Carregar pedido
  let order = null
  try {
    order = $app.findRecordById('store_orders', orderId)
  } catch (orderErr) {
    return e.json(404, {
      ok: false,
      error: 'Pedido não encontrado: ' + orderErr,
    })
  }

  // 2. Carregar produto vinculado
  let product = null
  const productId = order.getString('product_id')
  try {
    product = $app.findRecordById('products', productId)
  } catch (prodErr) {
    return e.json(404, {
      ok: false,
      error: 'Produto do pedido não encontrado: ' + prodErr,
    })
  }

  // 3. Obter credenciais do Mercado Pago
  let accessToken = ''
  let statementDescriptor = 'AMBICORP'
  try {
    const sRecords = $app.findRecordsByFilter('mercadopago_settings', '1=1', '-created', 1, 0)
    if (sRecords && sRecords.length > 0) {
      const s = sRecords[0]
      accessToken = s.getString('mp_access_token').trim()
      const isEnabled = s.getBool('mp_enabled')
      if (!isEnabled) {
        return e.json(400, {
          ok: false,
          fallback_to_whatsapp: true,
          error: 'O checkout via Mercado Pago está temporariamente desativado.',
        })
      }
      if (s.getString('statement_descriptor')) {
        statementDescriptor = s.getString('statement_descriptor').trim().substring(0, 16)
      }
    }
  } catch (sErr) {
    console.log('[mp_create_pref] Erro ao buscar configurações: ' + sErr)
  }

  if (!accessToken) {
    return e.json(400, {
      ok: false,
      fallback_to_whatsapp: true,
      error:
        'Credenciais do Mercado Pago não configuradas. Por favor, finalize a compra via WhatsApp.',
    })
  }

  // 4. Montar URLs de retorno (Sucesso, Falha, Pendente)
  // Se o cliente forneceu returnBaseUrl (ex: https://meusite.com/loja/retorno), usamos como base
  let baseReturn = returnBaseUrl
  if (!baseReturn) {
    baseReturn = 'https://controle-de-lotes-de-equipamentos-25024.shrd00.internal.goskip.dev'
  }
  // Remove barra no final se houver
  if (baseReturn.endsWith('/')) {
    baseReturn = baseReturn.slice(0, -1)
  }

  const successUrl = baseReturn + '/loja/pedido-concluido?order_id=' + orderId + '&status=approved'
  const failureUrl = baseReturn + '/loja/pedido-concluido?order_id=' + orderId + '&status=failure'
  const pendingUrl = baseReturn + '/loja/pedido-concluido?order_id=' + orderId + '&status=pending'

  // 5. Montar payload do Mercado Pago Checkout Pro
  const unitPrice = order.getFloat('unit_price') || product.getFloat('unit_price') || 0
  const quantity = order.getInt('quantity') || 1
  const productName = product.getString('name') || 'Notebook Corporativo Recondicionado'
  const productSku = product.getString('sku') || product.getString('code') || productId

  const customerName = order.getString('customer_name') || ''
  const customerPhone = order.getString('customer_phone') || ''
  const customerEmail = order.getString('customer_email') || 'cliente@ambicorpflow.com.br'

  // Separar primeiro nome e sobrenome
  const nameParts = customerName.trim().split(' ')
  const firstName = nameParts[0] || 'Cliente'
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Loja'

  const preferencePayload = {
    items: [
      {
        id: productSku,
        title: productName.substring(0, 250),
        description: ('Equipamento revisado AMbicorpFlow - SKU: ' + productSku).substring(0, 250),
        quantity: quantity,
        currency_id: 'BRL',
        unit_price: unitPrice,
      },
    ],
    payer: {
      name: firstName,
      surname: lastName,
      email: customerEmail,
      phone: {
        area_code: customerPhone.replace(/\D/g, '').substring(2, 4) || '31',
        number: customerPhone.replace(/\D/g, '').substring(4) || customerPhone.replace(/\D/g, ''),
      },
    },
    back_urls: {
      success: successUrl,
      failure: failureUrl,
      pending: pendingUrl,
    },
    auto_return: 'approved',
    external_reference: orderId,
    statement_descriptor: statementDescriptor,
    metadata: {
      order_id: orderId,
      product_id: productId,
      product_sku: productSku,
    },
  }

  // 6. Enviar para API do Mercado Pago
  try {
    const mpRes = $http.send({
      url: 'https://api.mercadopago.com/checkout/preferences',
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(preferencePayload),
      timeout: 20,
    })

    if (mpRes.statusCode >= 200 && mpRes.statusCode < 300 && mpRes.json) {
      const prefData = mpRes.json
      const preferenceId = prefData.id || ''
      const initPoint = prefData.init_point || ''
      const sandboxInitPoint = prefData.sandbox_init_point || ''

      // Atualizar pedido interno com os IDs da preferência
      try {
        order.set('mp_preference_id', preferenceId)
        order.set('mp_init_point', initPoint)
        $app.save(order)
      } catch (saveErr) {
        console.log('[mp_create_pref] Erro ao atualizar pedido com preference_id: ' + saveErr)
      }

      return e.json(200, {
        ok: true,
        preference_id: preferenceId,
        init_point: initPoint,
        sandbox_init_point: sandboxInitPoint,
        order_id: orderId,
      })
    } else {
      const errJson = mpRes.json || {}
      const detail = errJson.message || 'Código HTTP ' + mpRes.statusCode
      console.log('[mp_create_pref] Erro retornado pela API do MP: ' + JSON.stringify(errJson))
      return e.json(500, {
        ok: false,
        fallback_to_whatsapp: true,
        error: 'Mercado Pago não pôde gerar o link de pagamento: ' + detail,
      })
    }
  } catch (reqErr) {
    console.log('[mp_create_pref] Exceção de rede com Mercado Pago: ' + reqErr)
    return e.json(500, {
      ok: false,
      fallback_to_whatsapp: true,
      error: 'Falha de comunicação ao conectar com Mercado Pago.',
    })
  }
})
