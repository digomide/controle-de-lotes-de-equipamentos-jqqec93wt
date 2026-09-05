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

  // 3. Buscar dados do produto local se fornecido (opcional — ferramenta opera de forma autônoma)
  let localProduct = null
  let itemCondition = 'used' // Padrão para notebooks da loja

  if (customCondition) {
    if (customCondition === 'new' || customCondition === 'used') {
      itemCondition = customCondition
    }
  }

  if (productId) {
    try {
      localProduct = appId.findRecordById('products', productId)
      if (localProduct && !customCondition) {
        const condType = localProduct.getString('condition_type') || ''
        if (condType === 'novo') itemCondition = 'new'
        else itemCondition = 'used'
      }
    } catch (eProd) {
      console.warn('[ml_catalog_publish] Produto local opcional não encontrado:', productId, eProd)
    }
  }

  // 4. Montar variações de payload para publicação no Catálogo do ML
  // REGRA CRÍTICA DO MERCADO LIVRE:
  // Em publicação de catálogo (catalog_listing: true + catalog_product_id),
  // o campo "title" NÃO PODE ser enviado (o ML rejeita com body.invalid_fields [title] are invalid).
  // O título, fotos, descrição e atributos canônicos são herdados do próprio catálogo.
  //
  // Além disso, na API de Catálogo do ML:
  // Se a condição for 'used' e o catálogo exigir 'new' (item_not_new_nor_refurbished),
  // tentamos em cascata:
  // 1. Condição solicitada ('used' ou 'new')
  // 2. Se 'used' falhar por elegibilidade, testar 'new'
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

  // Variação A: Condição padrão informada
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

  // Variação B: Se a condição for 'used', tentar 'new' caso o catálogo seja restrito a novos
  if (itemCondition === 'used') {
    const payloadB = {
      catalog_product_id: catalogProductId,
      catalog_listing: true,
      category_id: categoryId,
      price: price,
      currency_id: 'BRL',
      available_quantity: quantity,
      buying_mode: 'buy_it_now',
      listing_type_id: 'gold_special',
      condition: 'new',
      sale_terms: baseSaleTerms,
      shipping: baseShipping,
    }
    variationsToTry.push({ name: 'fallback_condition_new', payload: payloadB })
  }

  // 5. Enviar POST /items para o Mercado Livre
  let finalResponse = null
  let successfulPayload = null
  let lastErrorData = null
  let lastStatusCode = 400

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
        const isNotEligibleUsed =
          resStr.indexOf('item_not_new_nor_refurbished') >= 0 ||
          resStr.indexOf('catalog_listing.not_eligible') >= 0
        if (!isNotEligibleUsed && variationsToTry.length > vIdx + 1) {
          break
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
    rec.set('error_message', '')
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
            (successfulPayload ? ' (condição: ' + successfulPayload.condition + ')' : ''),
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
        'Este produto de catálogo no Mercado Livre exige condição Novo ou Recondicionado oficial elegível.'
    } else if (errBody.message) {
      userMsg = errBody.message
    }

    if (Array.isArray(errBody.cause) && errBody.cause.length > 0) {
      const errorCauses = errBody.cause.filter(function (c) {
        return c.type !== 'warning' || (c.code && c.code.indexOf('lost_me1') === -1)
      })

      const targetCauses = errorCauses.length > 0 ? errorCauses : errBody.cause
      const translatedList = targetCauses.map(function (c) {
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
          if (c.message && c.message.indexOf('item_not_new_nor_refurbished') >= 0) {
            return 'O produto de catálogo exige condição Novo (não aceita oferta direta em seminovo comum).'
          }
          return (
            'Sua conta ou o produto não é elegível para disputar este catálogo (' +
            (c.message || c.code) +
            ').'
          )
        }
        if (c.code === 'item.condition.invalid') {
          return (
            'A condição do item (' +
            itemCondition +
            ') não é permitida para este produto de catálogo no Mercado Livre.'
          )
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

    rec.set('error_message', userMsg)
    rec.set('result_data', errBody)
    appId.save(rec)
  }
}, 'ml_catalog_publish_jobs')
