migrate(
  (app) => {
    const rec = app.findFirstRecordByFilter(
      'ml_ads_fetch_jobs',
      "status_filter = '__DIAG_INSPIRON_3576__'",
    )
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    let token = sRecords.length > 0 ? sRecords[0].getString('access_token') : ''

    // 1. Investigar as posições encontradas para 'dell inspiron 3576'
    // MLB15392536, etc.
    // 2. Investigar por que o anúncio MLB7591024470 está na conta do usuário sem catalog_product_id no fetch:
    // No Mercado Livre, quando um anúncio NÃO é catalog_listing, ele é um anúncio tradicional (marketplace).
    // Porém, o usuário relatou: "Ele mostrou um anúncio DELE ativo no ML: 'Dell Inspiron Inspiron 15-3576 (Recondicionado)', R$ 2.350, vendido por INFOPRECOBAIXO (+1000 vendas), página de catálogo com 'Status do recondicionado: Excelente', bullet 'Este é um produto recondicionado Excelente', 'Última em estoque!'."
    // OLHE A IMAGEM ANEXADA!
    // Na imagem anexada src/assets/image-e1fb1.png:
    // Título: "Dell Inspiron Inspiron 15-3576 (Recondicionado)"
    // Preço: "R$ 2.350"
    // "Este é um produto recondicionado Excelente"
    // "Status do recondicionado: Excelente"
    // "Processador: Intel Core i5 3576"
    // "Capacidade de disco SSD: 240 GB"
    // "Memória RAM: 8 GB"
    // "Vendido por INFOPRECOBAIXO"
    // E o layout é a página do produto no Mercado Livre!

    // Vamos buscar em /items/MLB7591024470 o objeto completo para ver TODOS os campos
    let fullItem = null
    if (token) {
      try {
        const it = $http.send({
          url: 'https://api.mercadolibre.com/items/MLB7591024470',
          method: 'GET',
          headers: { Authorization: 'Bearer ' + token },
          timeout: 10,
        })
        fullItem = it.json
      } catch (e) {}
    }

    // Verificar se há catalog_product_id ou parent_id ou similar
    let keys = fullItem ? Object.keys(fullItem) : []
    let nonNullKeys = {}
    if (fullItem) {
      keys.forEach((k) => {
        if (
          fullItem[k] != null &&
          fullItem[k] !== '' &&
          (!Array.isArray(fullItem[k]) || fullItem[k].length > 0)
        ) {
          if (typeof fullItem[k] === 'object') {
            nonNullKeys[k] = JSON.stringify(fullItem[k]).substring(0, 50)
          } else {
            nonNullKeys[k] = fullItem[k]
          }
        }
      })
    }

    rec.set(
      'progress_text',
      'itemTitle: ' +
        (fullItem ? fullItem.title : 'null') +
        ' | catalog_listing: ' +
        (fullItem ? fullItem.catalog_listing : 'null'),
    )
    rec.set('error_message', JSON.stringify(nonNullKeys))
    app.save(rec)
  },
  (app) => {},
)
