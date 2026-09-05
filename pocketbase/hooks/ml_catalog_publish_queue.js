/// <reference path="../pb_data/types.d.ts" />

/**
 * Hook de fila para publicação de Anúncios de Catálogo no Mercado Livre
 * Executa ao criar um registro em ml_catalog_publish_jobs (ou ao atualizar para status='pending').
 * Cria o anúncio associado a catalog_product_id via POST https://api.mercadolibre.com/items
 * Atualiza o produto local associando catalog_product_id, ml_listing_id e ml_listing_url.
 * NOTA: Toda a lógica fica inline dentro do callback para evitar problemas de escopo do JSVM.
 */

onRecordAfterCreateSuccess((e) => {
  const rec = e.record
  const appId = $app

  rec.set('status', 'processing')
  appId.save(rec)

  const catalogProductId = (rec.getString('catalog_product_id') || '').trim()
  const productId = rec.getString('product_id') || ''
  const price = rec.getInt('price') || 0
  const quantity = rec.getInt('quantity') || 1
  const domainId = rec.getString('domain_id') || 'MLB-NOTEBOOKS'
  const customCondition = rec.getString('condition') || ''

  // 1. Obter token ML e configurações
  let token = ''
  let defaultWarrantyDays = 90
  try {
    const sRecords = appId.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (sRecords && sRecords.length > 0) {
      const s = sRecords[0]
      token = s.getString('access_token')
      const refreshToken = s.getString('refresh_token')
      const expiresAt = s.getDateTime('token_expires_at')
      const clientId = s.getString('client_id') || $os.getenv('ML_CLIENT_ID') || ''
      const clientSecret = s.getString('client_secret') || $os.getenv('ML_CLIENT_SECRET') || ''

      const now = new Date()
      const exp = expiresAt ? new Date(expiresAt.time()) : null
      const needRefresh = !token || (exp && exp.getTime() - now.getTime() < 5 * 60 * 1000)

      if (needRefresh && refreshToken && clientId && clientSecret) {
        try {
          const tRes = $http.send({
            url: 'https://api.mercadolibre.com/oauth/token',
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body:
              'grant_type=refresh_token&client_id=' +
              encodeURIComponent(clientId) +
              '&client_secret=' +
              encodeURIComponent(clientSecret) +
              '&refresh_token=' +
              encodeURIComponent(refreshToken),
            timeout: 15,
          })
          if (tRes.statusCode === 200) {
            const d = tRes.json
            token = d.access_token
            s.set('access_token', d.access_token)
            if (d.refresh_token) s.set('refresh_token', d.refresh_token)
            if (d.expires_in) {
              const newExp = new Date(Date.now() + d.expires_in * 1000)
              s.set('token_expires_at', newExp.toISOString().replace('T', ' ').substring(0, 19))
            }
            appId.save(s)
          }
        } catch (tErr) {
          console.warn('[ml_catalog_publish] Erro ao renovar token ML:', tErr)
        }
      }
    }
  } catch (errAuth) {
    console.warn('[ml_catalog_publish] Erro ao carregar ml_settings:', errAuth)
  }

  if (!token) {
    rec.set('status', 'error')
    rec.set('status_code', 401)
    rec.set(
      'error_message',
      'Mercado Livre não autenticado ou token expirado. Configure na tela de Configurações.',
    )
    appId.save(rec)
    return
  }

  if (!catalogProductId) {
    rec.set('status', 'error')
    rec.set('status_code', 400)
    rec.set('error_message', 'catalog_product_id é obrigatório para anúncio de catálogo.')
    appId.save(rec)
    return
  }

  // 2. Buscar detalhes do produto de catálogo no ML para herdar categoria e atributos base
  let catDetails = null
  let categoryId = 'MLB1652' // Categoria default de Notebooks MLB
  let catalogTitle = 'Notebook'

  try {
    const prodRes = $http.send({
      url: 'https://api.mercadolibre.com/products/' + catalogProductId,
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/json',
      },
      timeout: 12,
    })
    if (prodRes.statusCode === 200 && prodRes.json) {
      catDetails = prodRes.json
      if (catDetails.category_id) categoryId = catDetails.category_id
      if (catDetails.name) catalogTitle = catDetails.name
    }
  } catch (eCat) {
    console.warn('[ml_catalog_publish] Falha ao consultar produto de catálogo:', eCat)
  }

  // 3. Determinar a condição do anúncio (condition)
  // Aceita: "new", "refurbished", "used", ou herança automática da posição de catálogo ("catalog_auto" / vazio).
  // IMPORTANTE: O ML só aceita 'new', 'refurbished' e 'used' (não existe 'excelente' na API do ML).
  let localProduct = null
  let itemCondition = 'new' // fallback seguro

  // Se o usuário selecionou uma condição explícita
  if (
    customCondition === 'new' ||
    customCondition === 'refurbished' ||
    customCondition === 'used'
  ) {
    itemCondition = customCondition
  } else {
    // "catalog_auto" ou não especificada: tentar herdar da posição de catálogo detectada
    let detectedFromCat = ''
    if (catDetails) {
      if (Array.isArray(catDetails.attributes)) {
        for (let a = 0; a < catDetails.attributes.length; a++) {
          const attr = catDetails.attributes[a]
          if (!attr || !attr.id) continue
          const attrIdUpper = String(attr.id).toUpperCase()
          if (
            attrIdUpper === 'ITEM_CONDITION' ||
            attrIdUpper === 'CONDITION' ||
            attrIdUpper === 'PRODUCT_CONDITION'
          ) {
            const valName = String(attr.value_name || '')
              .toLowerCase()
              .trim()
            const valId = String(attr.value_id || '').trim()
            if (valId === '2230284' || valName === 'novo' || valName === 'new')
              detectedFromCat = 'new'
            else if (
              valId === '2230581' ||
              valName.indexOf('recondicionado') >= 0 ||
              valName.indexOf('refurbished') >= 0
            )
              detectedFromCat = 'refurbished'
            else if (valId === '2230582' || valName === 'usado' || valName === 'used')
              detectedFromCat = 'used'
          }
        }
      }
      if (!detectedFromCat && catDetails.condition) {
        const rootC = String(catDetails.condition).toLowerCase().trim()
        if (rootC === 'new' || rootC === 'refurbished' || rootC === 'used') detectedFromCat = rootC
      }
    }

    if (detectedFromCat) {
      itemCondition = detectedFromCat
    } else if (productId) {
      try {
        localProduct = appId.findRecordById('products', productId)
        if (localProduct) {
          const condType = localProduct.getString('condition_type') || ''
          if (condType === 'novo') itemCondition = 'new'
          else if (condType === 'recondicionado') itemCondition = 'refurbished'
          else itemCondition = 'used'
        }
      } catch (eProd) {
        console.warn(
          '[ml_catalog_publish] Produto local opcional não encontrado:',
          productId,
          eProd,
        )
      }
    } else {
      // Padrão de notebooks de catálogo sem outra indicação: new
      itemCondition = 'new'
    }
  }

  if (productId && !localProduct) {
    try {
      localProduct = appId.findRecordById('products', productId)
    } catch (_) {}
  }

  // 4. Montar variações de payload para publicação no Catálogo do ML
  // REGRA CRÍTICA DO MERCADO LIVRE:
  // Em publicação de catálogo (catalog_listing: true + catalog_product_id),
  // o campo "title" e "pictures" NÃO PODEM ser enviados (o ML rejeita com body.invalid_fields).
  // O título, fotos, descrição e atributos canônicos são herdados do próprio catálogo.
  //
  // Quando o usuário escolheu explicitamente uma condição (ex: 'refurbished' ou 'new' ou 'used'),
  // enviamos EXATAMENTE a condição escolhida pelo usuário. Não fazemos fallback automático agressivo
  // que altere a condição sem o usuário saber, pois ele quer testar ou saber exatamente por que a posição recusou.
  const baseShipping = {
    mode: 'me2',
    local_pick_up: true,
    free_shipping: price >= 79,
  }

  const baseSaleTerms = [
    {
      id: 'WARRANTY_TYPE',
      value_name: 'Garantia do vendedor',
    },
    {
      id: 'WARRANTY_TIME',
      value_name: defaultWarrantyDays + ' dias',
    },
  ]

  const variationsToTry = []

  // Variação A: Condição solicitada / resolvida
  const payloadA = {
    catalog_product_id: catalogProductId,
    catalog_listing: true,
    category_id: categoryId,
    price: price,
    currency_id: 'BRL',
    available_quantity: quantity,
    buying_mode: 'buy_it_now',
    listing_type_id: 'gold_special',
    condition: itemCondition,
    sale_terms: baseSaleTerms,
    shipping: baseShipping,
  }
  variationsToTry.push({ name: 'padrao_' + itemCondition, payload: payloadA })

  // 5. Enviar POST /items para o Mercado Livre
  let finalResponse = null
  let successfulPayload = null
  let lastErrorData = null
  let lastStatusCode = 400
  let fallbackFromCondition = '' // Registra se houve fallback de condição (ex.: refurbished -> used)

  for (let vIdx = 0; vIdx < variationsToTry.length; vIdx++) {
    const curVar = variationsToTry[vIdx]
    const payloadToSend = curVar.payload

    // Garante que campos proibidos pelo catálogo NÃO sejam enviados
    delete payloadToSend.title
    delete payloadToSend.pictures
    delete payloadToSend.description

    try {
      console.log(
        '[ml_catalog_publish] Tentativa ' +
          (vIdx + 1) +
          ' (' +
          curVar.name +
          ') para ' +
          catalogProductId,
      )

      const postRes = $http.send({
        url: 'https://api.mercadolibre.com/items',
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payloadToSend),
        timeout: 25,
      })

      lastStatusCode = postRes.statusCode
      const resJson = postRes.json || {}

      if (postRes.statusCode === 200 || postRes.statusCode === 201) {
        finalResponse = resJson
        successfulPayload = payloadToSend
        break
      } else {
        lastErrorData = resJson
        console.warn(
          '[ml_catalog_publish] Falha na tentativa ' +
            curVar.name +
            ': status ' +
            postRes.statusCode,
          JSON.stringify(resJson),
        )

        const resStr = JSON.stringify(resJson)

        // RETRY / FALLBACK AUTOMÁTICO:
        // Se a tentativa foi com 'refurbished' e o ML recusou por condição não suportada na categoria
        // (ex: "Category MLB1652 for channel marketplace only supports conditions: [used, new, not_specified]")
        // ou item.condition.invalid que lista used como suportado,
        // retentamos automaticamente com a condição "used" antes de registrar erro!
        const isConditionInvalid =
          resStr.indexOf('item.condition.invalid') >= 0 ||
          resStr.indexOf('only supports conditions') >= 0
        const isRefurbishedAttempt = payloadToSend.condition === 'refurbished'

        if (isRefurbishedAttempt && isConditionInvalid) {
          const alreadyQueuedFallback = variationsToTry.some(function (v) {
            return v.name === 'fallback_auto_used'
          })
          if (!alreadyQueuedFallback) {
            console.log(
              '[ml_catalog_publish] Detectada recusa de refurbished pelo ML para ' +
                catalogProductId +
                '. Enfileirando retentativa automática com condição "used"...',
            )
            const fallbackPayload = JSON.parse(JSON.stringify(payloadToSend))
            fallbackPayload.condition = 'used'
            variationsToTry.push({
              name: 'fallback_auto_used',
              payload: fallbackPayload,
              fallbackFrom: 'refurbished',
            })
            fallbackFromCondition = 'refurbished'
            continue
          }
        }

        const isNotEligibleUsed =
          resStr.indexOf('item_not_new_nor_refurbished') >= 0 ||
          resStr.indexOf('catalog_listing.not_eligible') >= 0
        if (!isNotEligibleUsed && variationsToTry.length > vIdx + 1) {
          // Se não há outra variação queued, sai do loop
          if (vIdx === variationsToTry.length - 1) {
            break
          }
        }
      }
    } catch (errSend) {
      console.error('[ml_catalog_publish] Exceção na requisição:', errSend)
      lastErrorData = { error: String(errSend) }
      lastStatusCode = 500
      break
    }
  }

  rec.set('status_code', lastStatusCode)

  if (finalResponse && (finalResponse.id || finalResponse.permalink)) {
    const listingId = finalResponse.id || ''
    const listingUrl = finalResponse.permalink || 'https://produto.mercadolivre.com.br/' + listingId

    rec.set('status', 'done')
    rec.set('ml_listing_id', listingId)
    rec.set('ml_listing_url', listingUrl)
    rec.set('result_data', finalResponse)

    // Se houve fallback automático de condição com sucesso, registrar mensagem informativa
    if (fallbackFromCondition && successfulPayload && successfulPayload.condition === 'used') {
      const fallbackNote =
        'Recusado como "Recondicionado" (não suportado na categoria MLB1652 do ML), republicado automaticamente como "Usado" com sucesso.'
      rec.set('error_message', fallbackNote)
      console.log('[ml_catalog_publish] ' + fallbackNote + ' ID: ' + listingId)
    } else {
      rec.set('error_message', '')
    }
    appId.save(rec)

    // Atualizar o produto local correspondente
    if (localProduct) {
      try {
        localProduct.set('ml_listing_id', listingId)
        localProduct.set('ml_listing_url', listingUrl)
        localProduct.set('ml_listing_status', 'active')
        localProduct.set('catalog_product_id', catalogProductId)
        localProduct.set(
          'ml_published_at',
          new Date().toISOString().replace('T', ' ').substring(0, 19),
        )

        const history = []
        try {
          const curHist = localProduct.get('history_events')
          if (Array.isArray(curHist)) history.push.apply(history, curHist)
        } catch (_) {}
        const condInfo = successfulPayload
          ? ' (condição: ' +
            successfulPayload.condition +
            (fallbackFromCondition ? ' - fallback automático de ' + fallbackFromCondition : '') +
            ')'
          : ''
        history.push({
          date: new Date().toISOString().replace('T', ' ').substring(0, 19),
          title: 'Anúncio de Catálogo publicado no Mercado Livre',
          details:
            'Anúncio ' +
            listingId +
            ' vinculado ao produto de catálogo ' +
            catalogProductId +
            ' por R$ ' +
            price +
            condInfo,
        })
        localProduct.set('history_events', history)

        appId.save(localProduct)
      } catch (eSaveProd) {
        console.warn('[ml_catalog_publish] Erro ao atualizar produto local:', eSaveProd)
      }
    }
  } else {
    // Tratar erro retornado pelo Mercado Livre com mensagens claras em português
    rec.set('status', 'error')
    const errBody = lastErrorData || {}
    let userMsg =
      'Falha ao publicar anúncio de catálogo no Mercado Livre (status ' + lastStatusCode + ')'

    const rawErrorStr = JSON.stringify(errBody)

    if (
      errBody.error &&
      errBody.error.indexOf('The fields') >= 0 &&
      errBody.error.indexOf('are invalid') >= 0
    ) {
      const matchFields = errBody.error.match(/The fields \[(.*?)\] are invalid/)
      const fieldList = matchFields ? matchFields[1] : 'informados'
      if (fieldList.indexOf('title') >= 0) {
        userMsg =
          'O campo "title" não é aceito em anúncio de catálogo (o título é herdado diretamente do catálogo no Mercado Livre).'
      } else {
        userMsg =
          'O(s) campo(s) [' +
          fieldList +
          '] não são aceitos para anúncio deste catálogo no Mercado Livre.'
      }
    } else if (errBody.message === 'body.invalid_fields') {
      userMsg = 'Campos inválidos enviados ao Mercado Livre para este anúncio de catálogo.'
    } else if (rawErrorStr.indexOf('item_not_new_nor_refurbished') >= 0) {
      userMsg =
        'Esta posição de catálogo exige condição Novo ou Recondicionado oficial. Posições de notebooks no canal marketplace aceitam "Novo" ou "Usado" (a categoria MLB1652 não aceita recondicionado no catálogo).'
    } else if (errBody.message) {
      userMsg = errBody.message
    }

    if (Array.isArray(errBody.cause) && errBody.cause.length > 0) {
      // Filtrar avisos secundários de frete/shipping que não são erros impeditivos
      const errorCauses = errBody.cause.filter(function (c) {
        if (c.type === 'warning') return false
        if (
          c.code &&
          (c.code.indexOf('lost_me1') !== -1 || c.code.indexOf('mandatory_free_shipping') !== -1)
        )
          return false
        return true
      })

      const targetCauses = errorCauses.length > 0 ? errorCauses : errBody.cause

      // Se houver causa de condição inválida (item.condition.invalid), o ML envia em conjunto um erro genérico
      // body.missing_fields com references: ["condition"] ("Missing fields").
      // Esse "Missing fields" é um artefato redundante gerado pelo validador do ML porque ele rejeitou o valor da condição.
      // Ocultamos "Missing fields" para condition quando a causa da recusa de condição já está presente e clara.
      const hasConditionInvalidCause = targetCauses.some(function (c) {
        return (
          c.code === 'item.condition.invalid' ||
          (c.message && c.message.indexOf('only supports conditions') >= 0)
        )
      })

      const filteredCauses = targetCauses.filter(function (c) {
        if (hasConditionInvalidCause) {
          const isMissingCondition =
            c.code === 'body.missing_fields' &&
            Array.isArray(c.references) &&
            c.references.indexOf('condition') >= 0
          if (
            isMissingCondition ||
            (c.message === 'Missing fields' &&
              (!c.references || c.references.indexOf('condition') >= 0))
          ) {
            return false
          }
        }
        return true
      })

      const finalCausesToTranslate = filteredCauses.length > 0 ? filteredCauses : targetCauses

      const condLabelPt =
        itemCondition === 'refurbished'
          ? 'Recondicionado'
          : itemCondition === 'used'
            ? 'Usado'
            : 'Novo'

      const translatedList = finalCausesToTranslate.map(function (c) {
        if (c.code === 'item.price.invalid' || (c.message && c.message.indexOf('price') >= 0)) {
          return 'Preço informado (R$ ' + price + ') incompatível com as regras deste catálogo.'
        }
        if (c.code === 'item.catalog_product_id.invalid') {
          return (
            'O produto de catálogo (' +
            catalogProductId +
            ') não é válido para publicação direta ou está inativo.'
          )
        }
        if (c.code === 'item.catalog_listing.not_eligible') {
          let acceptedConds = 'Novo'
          if (c.cause && typeof c.cause === 'string') {
            acceptedConds = c.cause
          } else if (c.message && c.message.indexOf('item_not_new_nor_refurbished') >= 0) {
            acceptedConds = 'Novo (a posição não aceita publicação de usado/recondicionado)'
          }
          return (
            'O ML recusou a publicação nesta posição (' +
            catalogProductId +
            '). Motivo: esta posição do catálogo exige condição ' +
            acceptedConds +
            '.'
          )
        }
        if (
          c.code === 'item.condition.invalid' ||
          (c.message && c.message.indexOf('only supports conditions') >= 0)
        ) {
          // Extrair condições suportadas da mensagem do ML, ex: [used, new, not_specified]
          let supportedConds = ''
          const matchConds = (c.message || '').match(/supports conditions:\s*\[(.*?)\]/)
          if (matchConds) {
            supportedConds = matchConds[1]
              .split(',')
              .map(function (s) {
                const tr = s.trim()
                if (tr === 'used') return 'Usado (used)'
                if (tr === 'new') return 'Novo (new)'
                if (tr === 'not_specified') return 'Não especificado'
                return tr
              })
              .join(', ')
          } else {
            supportedConds = c.message || 'Novo ou Usado'
          }

          let msg =
            'O Mercado Livre não aceita a condição "' +
            condLabelPt +
            '" para notebooks (categoria MLB1652). Condições aceitas pelo ML nesta categoria: ' +
            supportedConds +
            '.'

          if (fallbackFromCondition) {
            msg += ' Tentativa automática com "Usado" também não foi aceita nesta posição.'
          } else {
            msg += ' Utilize a condição "Usado" e destaque "Excelente" na descrição/fotos.'
          }
          return msg
        }
        if (
          c.code === 'body.missing_fields' ||
          (c.message && c.message.indexOf('Missing fields') >= 0)
        ) {
          const refList = Array.isArray(c.references) ? c.references.join(', ') : ''
          return 'Campos obrigatórios ausentes: ' + (refList || c.message)
        }
        if (c.message && c.message.indexOf('The fields') >= 0) {
          return 'Campos inválidos para anúncio de catálogo: ' + c.message
        }
        return c.message || c.code || JSON.stringify(c)
      })

      if (translatedList.length > 0) {
        userMsg = translatedList.join(' | ')
      }
    }

    if (fallbackFromCondition) {
      userMsg = 'Recusado como "Recondicionado" pelo ML. ' + userMsg
    }

    rec.set('error_message', userMsg)
    rec.set('result_data', errBody)
    appId.save(rec)
  }
}, 'ml_catalog_publish_jobs')
