migrate(
  (app) => {
    const rec = app.findFirstRecordByFilter(
      'ml_ads_fetch_jobs',
      "status_filter = '__DIAG_INSPIRON_3576__'",
    )
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    let token = sRecords.length > 0 ? sRecords[0].getString('access_token') : ''

    // 1. Investigar as posições encontradas para 'dell inspiron 3576'
    // 2. Por que o Inspiron do vendedor não tem catalog_product_id no ML?
    // O anúncio MLB7591024470 foi criado como marketplace tradicional ou foi criado em catálogo?
    // Na imagem:
    // "Dell Inspiron Inspiron 15-3576 (Recondicionado)"
    // "R$ 2.350"
    // "12x R$ 225,87"
    // "Este é um produto recondicionado Excelente"
    // "Status do recondicionado: Excelente"
    // "Processador: Intel Core i5 3576"
    // "Capacidade de disco SSD: 240 GB"
    // "Memória RAM: 8 GB"
    // "Vendido por INFOPRECOBAIXO"
    // "Última em estoque!"
    // Isso é a página do ANÚNCIO MLB7591024470!
    // No Mercado Livre, anúncios recondicionados de vendedores certificados (programa de recondicionados do ML)
    // exibem exatamente essa caixa "Este é um produto recondicionado Excelente / Status do recondicionado: Excelente"!
    // E o vendedor do sistema (INFOPRECOBAIXO) tem 564 anúncios sincronizados no sistema.
    // Desses anúncios, alguns têm catalog_product_id (como o Latitude 5420 que tem MLB2097858038),
    // MAS OUTROS anúncios de catálogo/recondicionados da própria conta NÃO têm catalog_product_id preenchido
    // (ou foram publicados sem catalog_product_id direto, ou a API do ML retorna catalog_product_id vazio nele).

    // Vamos verificar no ml_ads_fetch_jobs quantos anúncios têm catalog_product_id e quantos não têm:
    const adsJobs = app.findRecordsByFilter(
      'ml_ads_fetch_jobs',
      "status = 'done' && items_count > 0",
      '-created',
      1,
      0,
    )
    let rawAdsItems = adsJobs[0].getString('items') || adsJobs[0].get('items')
    let parsedAds = typeof rawAdsItems === 'string' ? JSON.parse(rawAdsItems) : rawAdsItems

    let withCat = 0
    let withoutCat = 0
    let recondicionados = []
    for (let i = 0; i < parsedAds.length; i++) {
      const a = parsedAds[i]
      if (a.catalog_product_id) withCat++
      else withoutCat++
      if (
        a.condition === 'refurbished' ||
        a.condition === 'recondicionado' ||
        String(a.title).toLowerCase().includes('recondicionado')
      ) {
        recondicionados.push({
          id: a.id,
          title: a.title,
          cat: a.catalog_product_id,
          cond: a.condition,
          grade: a.condition_grade,
        })
      }
    }

    rec.set(
      'progress_text',
      'withCat: ' +
        withCat +
        ' withoutCat: ' +
        withoutCat +
        ' totalRecond: ' +
        recondicionados.length,
    )
    rec.set(
      'error_message',
      JSON.stringify({
        withCat: withCat,
        withoutCat: withoutCat,
        recondSample: recondicionados.slice(0, 10),
      }),
    )
    app.save(rec)
  },
  (app) => {},
)
