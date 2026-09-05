/// <reference path="../pb_data/types.d.ts" />

/**
 * Hook de fila para publicação de Anúncios de Catálogo no Mercado Livre
 * Executa ao criar um registro em ml_catalog_publish_jobs.
 * Cria o anúncio associado a catalog_product_id via POST https://api.mercadolibre.com/items
 * Atualiza o produto local associando catalog_product_id, ml_listing_id e ml_listing_url.
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
  let catalogAttributes = []

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
      if (catDetails.attributes) catalogAttributes = catDetails.attributes
    }
  } catch (eCat) {
    console.warn('[ml_catalog_publish] Falha ao consultar produto de catálogo:', eCat)
  }

  // 3. Buscar dados do produto local se fornecido
  let localProduct = null
  let itemCondition = 'not_specified' // ou "used" para recondicionados
  let titleToUse = catalogTitle

  if (productId) {
    try {
      localProduct = appId.findRecordById('products', productId)
      if (localProduct) {
        const condType = localProduct.getString('condition_type') || ''
        if (condType === 'novo') itemCondition = 'new'
        else itemCondition = 'used' // Mercado Livre aceita "used" ou "new" para condition

        if (localProduct.getString('name')) {
          titleToUse = localProduct.getString('name')
        }
      }
    } catch (eProd) {
      console.warn('[ml_catalog_publish] Produto local não encontrado:', productId, eProd)
    }
  }

  if (customCondition) {
    if (customCondition === 'new' || customCondition === 'used') {
      itemCondition = customCondition
    }
  }

  // Se o título ficou genérico, usar o nome do catálogo
  if (!titleToUse || titleToUse === 'Notebook') {
    titleToUse = catDetails && catDetails.name ? catDetails.name : 'Notebook ' + catalogProductId
  }
  // Limitar título a 60 caracteres (regra ML)
  if (titleToUse.length > 60) {
    titleToUse = titleToUse.substring(0, 60).trim()
  }

  // 4. Montar payload para POST /items com catalog_product_id
  const payload = {
    title: titleToUse,
    category_id: categoryId,
    price: price,
    currency_id: 'BRL',
    available_quantity: quantity,
    buying_mode: 'buy_it_now',
    listing_type_id: 'gold_special', // Clássico (padrão ouro especial)
    condition: itemCondition,
    catalog_product_id: catalogProductId,
    catalog_listing: true,
    sale_terms: [
      {
        id: 'WARRANTY_TYPE',
        value_name: 'Garantia do vendedor',
      },
      {
        id: 'WARRANTY_TIME',
        value_name: defaultWarrantyDays + ' dias',
      },
    ],
    shipping: {
      mode: 'me2',
      local_pick_up: true,
      free_shipping: price >= 79,
    },
  }

  // Se tiver atributos essenciais do produto de catálogo (marca, modelo), replicar no item
  if (catalogAttributes && catalogAttributes.length > 0) {
    const attrsToSend = []
    catalogAttributes.forEach((a) => {
      if (['BRAND', 'MODEL', 'LINE', 'PROCESSOR_BRAND', 'PROCESSOR_MODEL'].indexOf(a.id) >= 0) {
        if (a.value_name || a.value_id) {
          attrsToSend.push({
            id: a.id,
            value_id: a.value_id || null,
            value_name: a.value_name || null,
          })
        }
      }
    })
    if (attrsToSend.length > 0) {
      payload.attributes = attrsToSend
    }
  }

  // 5. Enviar POST /items para o Mercado Livre
  try {
    const postRes = $http.send({
      url: 'https://api.mercadolibre.com/items',
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      timeout: 25,
    })

    rec.set('status_code', postRes.statusCode)

    if (postRes.statusCode === 200 || postRes.statusCode === 201) {
      const data = postRes.json
      const listingId = data.id || ''
      const listingUrl = data.permalink || 'https://produto.mercadolivre.com.br/' + listingId

      rec.set('status', 'done')
      rec.set('ml_listing_id', listingId)
      rec.set('ml_listing_url', listingUrl)
      rec.set('result_data', data)
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
              price,
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
      const errBody = postRes.json || {}
      let userMsg =
        'Falha ao publicar anúncio de catálogo no Mercado Livre (status ' + postRes.statusCode + ')'

      if (errBody.message) {
        userMsg = errBody.message
      }

      if (Array.isArray(errBody.cause) && errBody.cause.length > 0) {
        const causes = errBody.cause.map(function (c) {
          if (c.code === 'item.price.invalid' || (c.message && c.message.indexOf('price') >= 0)) {
            return 'Preço informado (R$ ' + price + ') incompatível com o exigido pelo catálogo.'
          }
          if (c.code === 'item.catalog_product_id.invalid') {
            return (
              'O produto de catálogo (' +
              catalogProductId +
              ') não é válido para publicação direta ou está inativo.'
            )
          }
          if (c.code === 'item.condition.invalid') {
            return (
              'A condição do item (' +
              itemCondition +
              ') não é permitida para este produto de catálogo no Mercado Livre.'
            )
          }
          if (c.message) return c.message
          return JSON.stringify(c)
        })
        userMsg += ': ' + causes.join(' | ')
      }

      rec.set('error_message', userMsg)
      rec.set('result_data', errBody)
      appId.save(rec)
    }
  } catch (errRequest) {
    console.error('[ml_catalog_publish] Exceção na requisição:', errRequest)
    rec.set('status', 'error')
    rec.set('status_code', 500)
    rec.set(
      'error_message',
      'Erro de conexão ao comunicar com a API do Mercado Livre: ' + String(errRequest),
    )
    appId.save(rec)
  }
}, 'ml_catalog_publish_jobs')
