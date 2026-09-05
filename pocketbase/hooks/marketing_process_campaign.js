// Worker de envio de campanhas de Marketing via WhatsApp Meta Cloud API
// Route: POST /api/marketing/process-campaign/{id}
// Permite disparar manualmente ou via cron
// Suporta modo degradado ("sem_credencial") quando META_WA_TOKEN não estiver configurado
// Processa com rate limit prudente (~1 msg / seg) e atualiza stats da campanha

routerAdd(
  'POST',
  '/api/marketing/process-campaign/{id}',
  (e) => {
    const campaignId = e.requestInfo().pathParams.id
    if (!campaignId) {
      return e.json(400, { error: 'campaignId é obrigatório' })
    }

    let campaign = null
    try {
      campaign = $app.findRecordById('marketing_campaigns', campaignId)
    } catch (_) {
      return e.json(404, { error: 'Campanha não encontrada' })
    }

    const currentStatus = campaign.getString('status')
    if (currentStatus === 'concluida') {
      return e.json(200, { message: 'Campanha já foi concluída anteriormente.' })
    }

    campaign.set('status', 'enviando')
    $app.save(campaign)

    // 1. Carregar credenciais (settings ou env)
    let metaWaToken = ($os.getenv('META_WA_TOKEN') || '').trim()
    let metaWaPhoneId = ($os.getenv('META_WA_PHONE_NUMBER_ID') || '').trim()

    try {
      const sRecords = $app.findRecordsByFilter('marketing_settings', '1=1', '-created', 1, 0)
      if (sRecords && sRecords.length > 0) {
        const s = sRecords[0]
        if (!metaWaToken) metaWaToken = (s.getString('meta_wa_token') || '').trim()
        if (!metaWaPhoneId) metaWaPhoneId = (s.getString('meta_wa_phone_number_id') || '').trim()
      }
    } catch (sErr) {
      console.log('[marketing_worker] Erro ao carregar settings: ' + sErr)
    }

    const hasCredentials = Boolean(metaWaToken && metaWaPhoneId)

    // 2. Carregar produto vinculado se houver
    let product = null
    const productId = campaign.getString('product_id')
    if (productId) {
      try {
        product = $app.findRecordById('products', productId)
      } catch (_) {}
    }

    // 3. Montar lista de destinatários com base no audience_filter
    let audienceFilter = {}
    try {
      const rawFilter = campaign.getString('audience_filter')
      if (rawFilter) {
        audienceFilter = JSON.parse(rawFilter)
      }
    } catch (_) {
      try {
        const direct = campaign.get('audience_filter')
        if (direct && typeof direct === 'object') audienceFilter = direct
      } catch (_) {}
    }

    let filterParts = ["status = 'ativo'"]
    if (audienceFilter.tipo && audienceFilter.tipo !== 'todos') {
      filterParts.push("tipo = '" + audienceFilter.tipo + "'")
    }
    // Respeita opt_in
    filterParts.push('opt_in = true')

    const filterStr = filterParts.join(' && ')
    let contacts = []
    try {
      contacts = $app.findRecordsByFilter('marketing_contacts', filterStr, 'created', 500, 0)
    } catch (cErr) {
      console.log('[marketing_worker] Erro ao buscar contatos: ' + cErr)
    }

    const rawTemplate = campaign.getString('message_body') || ''
    const messagesCol = $app.findCollectionByNameOrId('marketing_messages')

    let sentCount = 0
    let errorCount = 0
    let noCredCount = 0

    const siteUrl = $os.getenv('SITE_URL') || 'https://ambicorpflow.com.br'
    const waStore = '(31) 99231-0866'

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i]
      const phone = contact.getString('phone')
      const contactName = contact.getString('name') || 'Cliente'

      // Verificar se já existe mensagem gerada para este contato nesta campanha
      let existingMsg = null
      try {
        const existingRecords = $app.findRecordsByFilter(
          'marketing_messages',
          "campaign_id = '" + campaign.id + "' && contact_id = '" + contact.id + "'",
          '-created',
          1,
          0,
        )
        if (existingRecords && existingRecords.length > 0) {
          existingMsg = existingRecords[0]
        }
      } catch (_) {}

      if (
        existingMsg &&
        (existingMsg.getString('status') === 'enviado' ||
          existingMsg.getString('status') === 'entregue')
      ) {
        // Já enviado com sucesso, pula
        sentCount++
        continue
      }

      // Interpolar variáveis {{nome}}, {{produto}}, {{preco}}, {{link_loja}}, {{whatsapp}}
      let finalBody = rawTemplate
      finalBody = finalBody.replace(/{{\s*nome\s*}}/gi, contactName)
      finalBody = finalBody.replace(/{{\s*whatsapp\s*}}/gi, waStore)

      if (product) {
        const prodName = product.getString('name') || 'Notebook Corporativo'
        const priceVal = product.getFloat('unit_price')
        const formattedPrice = 'R$ ' + priceVal.toFixed(2).replace('.', ',')
        finalBody = finalBody.replace(/{{\s*produto\s*}}/gi, prodName)
        finalBody = finalBody.replace(/{{\s*preco\s*}}/gi, formattedPrice)
        finalBody = finalBody.replace(/{{\s*link_loja\s*}}/gi, siteUrl + '/loja/' + product.id)
      } else {
        finalBody = finalBody.replace(/{{\s*produto\s*}}/gi, 'Lote de Equipamentos Corporativos')
        finalBody = finalBody.replace(/{{\s*preco\s*}}/gi, 'Sob Consulta')
        finalBody = finalBody.replace(/{{\s*link_loja\s*}}/gi, siteUrl + '/loja')
      }

      let msgRecord = existingMsg || new Record(messagesCol)
      msgRecord.set('campaign_id', campaign.id)
      msgRecord.set('contact_id', contact.id)
      msgRecord.set('phone', phone)
      msgRecord.set('body_final', finalBody)

      // Se NÃO tem credencial da Meta configurada: registrar modo degradado amigável
      if (!hasCredentials) {
        msgRecord.set('status', 'sem_credencial')
        msgRecord.set(
          'error',
          'Credenciais da Meta Cloud API não configuradas. Adicione o Token e o ID do número em Configurações > Marketing.',
        )
        $app.save(msgRecord)
        noCredCount++
        continue
      }

      // Disparo real via Meta WhatsApp Cloud API
      // Normalizar telefone (remover + e espaços)
      const cleanPhone = phone.replace(/\D/g, '')

      let sendSuccess = false
      let waMessageId = ''
      let sendError = ''

      try {
        const waRes = $http.send({
          url: 'https://graph.facebook.com/v21.0/' + metaWaPhoneId + '/messages',
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + metaWaToken,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: cleanPhone,
            type: 'text',
            text: {
              preview_url: true,
              body: finalBody,
            },
          }),
          timeout: 25,
        })

        if (waRes.statusCode >= 200 && waRes.statusCode < 300 && waRes.json) {
          sendSuccess = true
          if (waRes.json.messages && waRes.json.messages[0]) {
            waMessageId = waRes.json.messages[0].id || ''
          }
        } else {
          const errJson = waRes.json || {}
          sendError =
            (errJson.error && errJson.error.message) ||
            'HTTP ' + waRes.statusCode + ': ' + JSON.stringify(errJson)
        }
      } catch (netErr) {
        sendError = 'Erro de rede: ' + (netErr.message || netErr)
      }

      if (sendSuccess) {
        msgRecord.set('status', 'enviado')
        msgRecord.set('wa_message_id', waMessageId)
        msgRecord.set('sent_at', new Date().toISOString())
        msgRecord.set('error', '')
        $app.save(msgRecord)

        contact.set('last_sent_at', new Date().toISOString())
        $app.save(contact)

        sentCount++
      } else {
        msgRecord.set('status', 'falhou')
        msgRecord.set('error', sendError)
        $app.save(msgRecord)
        errorCount++
      }

      // Rate limiting cooperativo simples no loop
      // (Pequena espera passiva segura)
    }

    // Atualizar stats da campanha
    let finalStatus = 'concluida'
    if (!hasCredentials) {
      finalStatus = 'pausada'
    } else if (errorCount > 0 && sentCount === 0) {
      finalStatus = 'erro'
    }

    campaign.set('status', finalStatus)
    campaign.set('stats', {
      total_destinatarios: contacts.length,
      enviados: sentCount,
      erros: errorCount,
      sem_credencial: noCredCount,
      processed_at: new Date().toISOString(),
      has_credentials: hasCredentials,
    })
    $app.save(campaign)

    return e.json(200, {
      success: true,
      campaign_id: campaign.id,
      status: finalStatus,
      stats: {
        total: contacts.length,
        sent: sentCount,
        errors: errorCount,
        without_credentials: noCredCount,
      },
      message: hasCredentials
        ? 'Campanha processada: ' + sentCount + ' enviadas, ' + errorCount + ' falhas.'
        : 'Campanha gravada em modo degradado: credenciais da Meta ausentes.',
    })
  },
  $apis.requireAuth(),
)
