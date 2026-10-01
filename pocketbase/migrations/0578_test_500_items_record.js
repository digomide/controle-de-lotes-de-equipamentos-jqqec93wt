/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 1. Criar uma rota interna de teste para inspecionar resposta e erros de PocketBase
    // Mas uma migração executa no startup. Vamos ver o schema exato de ml_collector_imports
    const col = app.findCollectionByNameOrId('ml_collector_imports')
    const fieldsInfo = []
    for (let f of col.fields) {
      fieldsInfo.push({
        name: f.name,
        type: f.type,
        required: f.required,
        maxSize: f.maxSize,
        min: f.min,
        max: f.max,
        pattern: f.pattern,
      })
    }

    const testRec = new Record(col)
    // Tentar setar cada campo e validar
    testRec.set('search_term', 'fone de ouvido para capacete tomate')
    testRec.set(
      'source_url',
      'https://lista.mercadolivre.com.br/fone-de-ouvido-para-capacete-tomate',
    )
    testRec.set('imported_at', '2026-10-01T05:26:40.982Z')
    testRec.set('results_count', 500)
    testRec.set('with_sales_count', 120)
    testRec.set('notes', 'auto')
    testRec.set('tenant_id', 'ambicorpmestre1')

    // Payload simulando 10 páginas reais do coletor (~500 itens)
    const items = []
    for (let i = 0; i < 500; i++) {
      items.push({
        id: 'MLB' + (3000000000 + i),
        mlb_id: 'MLB' + (3000000000 + i),
        title: 'Intercomunicador Fone De Ouvido Bluetooth Para Capacete Moto Tomate MT-' + i,
        price: 189.9,
        currency: 'BRL',
        condition: 'novo',
        sold_quantity: i % 3 === 0 ? 100 : null,
        sold_quantity_text: i % 3 === 0 ? '+100 vendidos' : '',
        permalink: 'https://produto.mercadolivre.com.br/MLB-' + (3000000000 + i),
        thumbnail: 'https://http2.mlstatic.com/D_NQ_NP_2X_test.webp',
        seller_name: 'TOMATE OFICIAL',
        is_free_shipping: true,
        is_full: false,
      })
    }

    const payloadObj = {
      version: '1.1.0',
      source: 'auto',
      source_url: 'https://lista.mercadolivre.com.br/fone-de-ouvido-para-capacete-tomate',
      collected_at: '2026-10-01T05:26:40.982Z',
      search_term: 'fone de ouvido para capacete tomate',
      results_count: items.length,
      with_sales_count: 167,
      results: items,
    }

    testRec.set('payload', payloadObj)

    // Validar usando o validador interno do PocketBase
    // testRec.validate() ou app.save
    try {
      app.save(testRec)
      console.log('[0578] Registro com 500 itens salvo com sucesso! ID:', testRec.id)
      app.delete(testRec)
    } catch (saveErr) {
      console.log('[0578] ERRO ao salvar 500 itens:', saveErr)
      throw saveErr
    }
  },
  (app) => {},
)
