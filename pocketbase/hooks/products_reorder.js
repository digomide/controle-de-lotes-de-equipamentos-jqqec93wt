// Hook PocketBase para reordenar fotos (photos e images) de um produto diretamente
// Rota: POST /api/products/{id}/reorder-photos
// Evita o diff do REST API padrão que ignora reordenação de arrays de arquivos idênticos

routerAdd(
  'POST',
  '/api/products/{id}/reorder-photos',
  (e) => {
    // 1. Extrair ID do produto do path
    let productId = (e.request.pathValue('id') || '').trim()
    if (!productId) {
      const rawUrl = e.request.url ? e.request.url.path || '' : ''
      const match = rawUrl.match(/\/api\/products\/([^/?#]+)\/reorder-photos/)
      if (match && match[1]) {
        productId = match[1].trim()
      }
    }

    if (!productId) {
      return e.json(400, { error: 'ID do produto não informado.' })
    }

    // 2. Buscar o registro em products
    let record = null
    try {
      record = $app.findRecordById('products', productId)
    } catch (err) {
      return e.json(404, { error: 'Produto não encontrado.' })
    }

    // 3. Ler dados do corpo da requisição
    let data = {}
    try {
      data = e.requestInfo().body || {}
    } catch (_) {
      data = {}
    }

    // 4. Aplicar a nova ordem diretamente via record.set() sem acionar diff de upload de arquivos
    if (data.photos && Array.isArray(data.photos)) {
      record.set('photos', data.photos)
    }

    if (data.images && Array.isArray(data.images)) {
      record.set('images', data.images)
    }

    // 5. Salvar registro
    try {
      $app.save(record)
    } catch (saveErr) {
      return e.json(500, {
        error: 'Erro ao salvar reordenação de fotos: ' + (saveErr.message || saveErr),
      })
    }

    return e.json(200, record)
  },
  $apis.requireAuth(),
)
