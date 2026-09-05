// Cron diário de automação de Marketing:
// 1. Processa campanhas com status 'agendada' cuja data programada (scheduled_at) já chegou
// 2. Alimenta a fila diária do Instagram (social_posts) com equipamentos 'Disponível'
//    que ainda não foram postados nos últimos 7 dias (automação complementar do Instagram)
// Executa diariamente às 09:00: '0 9 * * *' (e a cada hora para checar agendamentos)

cronAdd('marketing_daily_scheduler', '0 * * * *', () => {
  const now = new Date()
  const nowIso = now.toISOString()
  console.log('[marketing_cron] Iniciando rotina periódica de marketing: ' + nowIso)

  // 1. Processar campanhas agendadas
  try {
    const scheduled = $app.findRecordsByFilter(
      'marketing_campaigns',
      "status = 'agendada' && scheduled_at <= '" + nowIso + "'",
      'scheduled_at',
      10,
      0,
    )

    for (let cIdx = 0; cIdx < scheduled.length; cIdx++) {
      const camp = scheduled[cIdx]
      console.log('[marketing_cron] Processando campanha agendada: ' + camp.getString('name'))

      // Disparar o processamento interno
      camp.set('status', 'enviando')
      $app.save(camp)

      // Carregar credenciais
      let metaWaToken = ($os.getenv('META_WA_TOKEN') || '').trim()
      let metaWaPhoneId = ($os.getenv('META_WA_PHONE_NUMBER_ID') || '').trim()
      try {
        const sRecords = $app.findRecordsByFilter('marketing_settings', '1=1', '-created', 1, 0)
        if (sRecords && sRecords.length > 0) {
          const s = sRecords[0]
          if (!metaWaToken) metaWaToken = (s.getString('meta_wa_token') || '').trim()
          if (!metaWaPhoneId) metaWaPhoneId = (s.getString('meta_wa_phone_number_id') || '').trim()
        }
      } catch (_) {}

      const hasCredentials = Boolean(metaWaToken && metaWaPhoneId)

      // Se não houver credenciais, marca como pausada e registra nos stats
      if (!hasCredentials) {
        camp.set('status', 'pausada')
        camp.set('stats', {
          enviados: 0,
          erros: 0,
          sem_credencial: 1,
          processed_at: nowIso,
          has_credentials: false,
          note: 'Pausada automaticamente pelo scheduler: credenciais da Meta ausentes.',
        })
        $app.save(camp)
        continue
      }

      // Buscar contatos da campanha
      let audienceFilter = {}
      try {
        const rawFilter = camp.getString('audience_filter')
        if (rawFilter) audienceFilter = JSON.parse(rawFilter)
      } catch (_) {}

      let filterParts = ["status = 'ativo'", 'opt_in = true']
      if (audienceFilter.tipo && audienceFilter.tipo !== 'todos') {
        filterParts.push("tipo = '" + audienceFilter.tipo + "'")
      }

      let contacts = []
      try {
        contacts = $app.findRecordsByFilter(
          'marketing_contacts',
          filterParts.join(' && '),
          'created',
          300,
          0,
        )
      } catch (_) {}

      let sentCount = 0
      let errorCount = 0
      const rawTemplate = camp.getString('message_body') || ''
      const messagesCol = $app.findCollectionByNameOrId('marketing_messages')

      for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i]
        const phone = contact.getString('phone')
        const cleanPhone = phone.replace(/\D/g, '')
        const contactName = contact.getString('name') || 'Cliente'

        let finalBody = rawTemplate
        finalBody = finalBody.replace(/{{\s*nome\s*}}/gi, contactName)
        finalBody = finalBody.replace(/{{\s*whatsapp\s*}}/gi, '(31) 99231-0866')

        let waSuccess = false
        let waId = ''
        let errDesc = ''

        try {
          const res = $http.send({
            url: 'https://graph.facebook.com/v21.0/' + metaWaPhoneId + '/messages',
            method: 'POST',
            headers: {
              Authorization: 'Bearer ' + metaWaToken,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: cleanPhone,
              type: 'text',
              text: { body: finalBody },
            }),
            timeout: 25,
          })

          if (res.statusCode >= 200 && res.statusCode < 300) {
            waSuccess = true
            if (res.json && res.json.messages && res.json.messages[0]) {
              waId = res.json.messages[0].id || ''
            }
          } else {
            errDesc = 'HTTP ' + res.statusCode
          }
        } catch (nErr) {
          errDesc = 'Rede: ' + (nErr.message || nErr)
        }

        const msgRecord = new Record(messagesCol)
        msgRecord.set('campaign_id', camp.id)
        msgRecord.set('contact_id', contact.id)
        msgRecord.set('phone', phone)
        msgRecord.set('body_final', finalBody)

        if (waSuccess) {
          msgRecord.set('status', 'enviado')
          msgRecord.set('wa_message_id', waId)
          msgRecord.set('sent_at', new Date().toISOString())
          sentCount++
        } else {
          msgRecord.set('status', 'falhou')
          msgRecord.set('error', errDesc)
          errorCount++
        }
        $app.save(msgRecord)
      }

      camp.set('status', 'concluida')
      camp.set('stats', {
        total: contacts.length,
        enviados: sentCount,
        erros: errorCount,
        processed_at: new Date().toISOString(),
      })
      $app.save(camp)
    }
  } catch (campErr) {
    console.log('[marketing_cron] Erro ao processar campanhas: ' + campErr)
  }

  // 2. Automação complementar do Instagram & TikTok:
  // Verifica produtos "Disponível" que ainda não estão na fila social_posts nos últimos 7 dias
  // e insere equipamentos na fila (alternando Instagram e TikTok) com formatos adequados
  try {
    const availableProducts = $app.findRecordsByFilter(
      'products',
      "status = 'Disponível'",
      '-created',
      20,
      0,
    )

    const socialCol = $app.findCollectionByNameOrId('social_posts')
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    let queuedCount = 0

    for (let pIdx = 0; pIdx < availableProducts.length; pIdx++) {
      if (queuedCount >= 2) break // Max 2 sugestões automáticas por rodada para não poluir

      const prod = availableProducts[pIdx]
      // Verificar se o produto já foi postado ou colocado na fila nos últimos 7 dias
      let recentlyQueued = false
      try {
        const existing = $app.findRecordsByFilter(
          'social_posts',
          "product_id = '" + prod.id + "' && created >= '" + sevenDaysAgo + "'",
          '-created',
          1,
          0,
        )
        if (existing && existing.length > 0) {
          recentlyQueued = true
        }
      } catch (_) {}

      if (!recentlyQueued) {
        // Alternar canal entre Instagram e TikTok
        const platform = queuedCount % 2 === 0 ? 'tiktok' : 'instagram'
        const formats =
          platform === 'tiktok'
            ? ['achadinho', 'urgencia', 'revendedor']
            : ['tecnico', 'urgencia', 'lote']
        const chosenFormat = formats[queuedCount % formats.length]

        const pName = prod.getString('name') || 'Notebook Corporativo'
        const pModel = prod.getString('model') || ''
        const pBrand = prod.getString('brand') || ''
        const pProc = prod.getString('processor') || ''
        const pRam = prod.getString('ram') || ''
        const pStorage = prod.getString('storage') || ''
        const pPrice = prod.getFloat('unit_price')
        const priceStr = 'R$ ' + pPrice.toFixed(2).replace('.', ',')

        let caption = ''
        if (platform === 'tiktok') {
          caption = '👀 Achei desse jeito e não acreditei no preço!\n\n'
          caption += '💻 ' + (pBrand + ' ' + pModel).trim() + '\n'
          caption += '⚡ Processador: ' + pProc + '\n'
          caption += '🧠 RAM: ' + pRam + '\n'
          caption += '🚀 SSD: ' + pStorage + '\n'
          caption += '💸 Apenas ' + priceStr + ' à vista!\n\n'
          caption += 'Notebook corporativo com nota, garantia e procedência garantida!\n'
          caption += '📦 Enviamos para todo o Brasil!\n\n'
          caption += '📲 WhatsApp: (31) 99231-0866\n'
          caption += '#tiktokbrasil #achadinhos #notebookrecondicionado #informatica #setup'
        } else {
          caption = '🔥 OPORTUNIDADE AMBICORPFLOW 🔥\n\n'
          caption += '💻 ' + (pBrand + ' ' + pModel).trim() + '\n'
          caption += '⚡ Processador: ' + pProc + '\n'
          caption += '🧠 RAM: ' + pRam + '\n'
          caption += '💾 Armazenamento: ' + pStorage + '\n'
          caption += '🏷️ Preço especial: ' + priceStr + '\n\n'
          caption += 'Equipamento corporativo revisado, com garantia e nota fiscal!\n'
          caption += '📦 Pronta entrega para revendedores e clientes finais.\n\n'
          caption += '📲 Chame no WhatsApp: (31) 99231-0866\n'
          caption += '#notebook #recondicionado #informatica #ti #lote #ambicorpflow'
        }

        const postRec = new Record(socialCol)
        postRec.set('product_id', prod.id)
        postRec.set('status', 'Pendente')
        postRec.set('format', chosenFormat)
        postRec.set('platform', platform)
        postRec.set('caption', caption)
        postRec.set(
          'notes',
          'Gerado automaticamente pelo robô de marketing diário (' + platform + ')',
        )
        $app.save(postRec)

        queuedCount++
        console.log('[marketing_cron] Produto adicionado à fila (' + platform + '): ' + pName)
      }
    }
  } catch (instaErr) {
    console.log('[marketing_cron] Erro na automação de social posts: ' + instaErr)
  }
})
