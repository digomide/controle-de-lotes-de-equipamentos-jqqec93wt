// Rota GET /api/ml/item/{id} - Consulta status ao vivo do anúncio no Mercado Livre
// Rota POST /api/ml/item/{id}/status - Altera status do anúncio (active, paused, closed)

routerAdd(
  'GET',
  '/api/ml/item/{id}',
  (e) => {
    const itemId = e.request.pathValue('id')
    if (!itemId) {
      return e.json(400, { error: 'ID do item obrigatório.' })
    }

    let settings = null
    try {
      const records = $app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
      if (records && records.length > 0) {
        settings = records[0]
      }
    } catch (_) {}

    const accessToken = settings ? settings.getString('access_token') : ''

    const headers = {}
    if (accessToken) {
      headers.Authorization = 'Bearer ' + accessToken
    }

    try {
      const res = $http.send({
        url: 'https://api.mercadolibre.com/items/' + itemId,
        method: 'GET',
        headers: headers,
        timeout: 15,
      })

      if (res.statusCode >= 400) {
        return e.json(
          res.statusCode,
          res.json || { error: 'Item não encontrado no Mercado Livre.' },
        )
      }

      const item = res.json || {}
      return e.json(200, {
        id: item.id,
        title: item.title,
        price: item.price,
        status: item.status, // active, paused, closed
        sub_status: item.sub_status,
        permalink: item.permalink,
        available_quantity: item.available_quantity,
        sold_quantity: item.sold_quantity,
      })
    } catch (err) {
      return e.json(502, { error: 'Falha ao consultar item no Mercado Livre: ' + err })
    }
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/api/ml/item/{id}/status',
  (e) => {
    const itemId = e.request.pathValue('id')
    const body = e.requestInfo().body || {}
    const newStatus = (body.status || '').toString().trim() // 'active', 'paused', 'closed'
    const productId = (body.product_id || '').toString().trim()

    if (!itemId || !newStatus) {
      return e.json(400, { error: 'Parâmetros inválidos. Informe itemId e novo status.' })
    }

    let settings = null
    try {
      const records = $app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
      if (records && records.length > 0) {
        settings = records[0]
      }
    } catch (_) {}

    if (!settings || !settings.getString('access_token')) {
      return e.json(400, { error: 'Mercado Livre não conectado.' })
    }

    let accessToken = settings.getString('access_token')

    try {
      const res = $http.send({
        url: 'https://api.mercadolibre.com/items/' + itemId,
        method: 'PUT',
        headers: {
          Authorization: 'Bearer ' + accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
        timeout: 20,
      })

      if (res.statusCode >= 400) {
        const errJson = res.json || {}
        return e.json(res.statusCode, {
          error: errJson.message || 'Falha ao alterar status no Mercado Livre.',
          raw: errJson,
        })
      }

      // Atualizar no produto se productId foi fornecido
      if (productId) {
        try {
          const product = $app.findRecordById('products', productId)
          product.set('ml_listing_status', newStatus)
          $app.save(product)
        } catch (_) {}
      }

      return e.json(200, {
        success: true,
        id: itemId,
        status: newStatus,
      })
    } catch (err) {
      return e.json(502, { error: 'Falha na comunicação com Mercado Livre: ' + err })
    }
  },
  $apis.requireAuth(),
)
