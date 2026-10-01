/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 1. Encontrar a coleção ml_collector_imports
    const col = app.findCollectionByNameOrId('ml_collector_imports')

    // Atualizar o maxSize do campo 'payload'
    const payloadField = col.fields.getByName('payload')
    if (payloadField) {
      // Definir maxSize para 30MB (30 * 1024 * 1024 = 31457280 bytes)
      payloadField.maxSize = 31457280
      console.log('[migration 0573] Campo payload maxSize atualizado para 30MB (31457280 bytes)')
    } else {
      col.fields.add(
        new JSONField({
          name: 'payload',
          required: false,
          maxSize: 31457280,
        }),
      )
      console.log('[migration 0573] Campo payload criado com maxSize 30MB')
    }

    app.save(col)

    // 2. Testar inserção de um payload grande (~2.5MB a 3MB) para garantir que salva perfeitamente
    const bigResults = []
    for (let i = 0; i < 2000; i++) {
      bigResults.push({
        id: 'MLB' + (2000000000 + i),
        mlb_id: 'MLB' + (2000000000 + i),
        title:
          'Fone De Ouvido Bluetooth Para Capacete Tomate Modelo Super Longo E Detalhado Com Descrição Extensa ' +
          i,
        price: 199.9,
        sold_quantity: 15,
        permalink:
          'https://produto.mercadolivre.com.br/MLB-' +
          (2000000000 + i) +
          '?searchVariation=1&tracking_id=abcdef1234567890abcdef1234567890',
        thumbnail: 'https://http2.mlstatic.com/D_NQ_NP_2X_' + (2000000000 + i) + '-F.webp',
        seller_name: 'VENDEDOR_DISTRIBUIDOR_AUTORIZADO_DO_BRASIL_LTDA',
        condition: 'new',
        is_free_shipping: true,
        is_full: true,
        extra_desc: 'X'.repeat(800),
      })
    }
    const bigPayload = {
      version: '1.1.0',
      source: 'auto',
      source_url: 'https://lista.mercadolivre.com.br/fone-de-ouvido-para-capacete-tomate',
      collected_at: new Date().toISOString(),
      search_term: 'fone de ouvido para capacete tomate',
      results_count: bigResults.length,
      with_sales_count: 50,
      results: bigResults,
    }

    const testRec = new Record(col)
    testRec.set('search_term', 'fone de ouvido para capacete tomate')
    testRec.set('payload', bigPayload)
    testRec.set('results_count', bigResults.length)
    testRec.set('with_sales_count', 50)
    testRec.set('notes', 'teste_validacao_30mb')
    testRec.set('tenant_id', 'ambicorpmestre1')

    app.save(testRec)
    console.log(
      '[migration 0573] Payload grande salvo com sucesso! ID: ' +
        testRec.id +
        ', tamanho: ~' +
        Math.round(JSON.stringify(bigPayload).length / 1024) +
        ' KB',
    )

    // Remover registro de teste
    app.delete(testRec)
    console.log('[migration 0573] Registro de teste removido com sucesso.')
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('ml_collector_imports')
      const payloadField = col.fields.getByName('payload')
      if (payloadField) {
        payloadField.maxSize = 1048576 // 1MB default
        app.save(col)
      }
    } catch (_) {}
  },
)
