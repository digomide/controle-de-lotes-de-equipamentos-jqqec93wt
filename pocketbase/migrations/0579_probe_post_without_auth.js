/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 1. Simular uma requisição não autenticada e autenticada
    // Vamos inspecionar exatamente o que acontece quando uma chamada POST chega sem auth token no PocketBase
    const col = app.findCollectionByNameOrId('ml_collector_imports')
    console.log('[probe 0579] col.createRule ANTES:', JSON.stringify(col.createRule))

    // Testar chamada HTTP com e sem auth
    const payloadBody = {
      search_term: 'fone de ouvido para capacete tomate',
      source_url: 'https://lista.mercadolivre.com.br/fone-de-ouvido-para-capacete-tomate',
      imported_at: new Date().toISOString(),
      payload: {
        version: '1.1.0',
        source: 'auto',
        results: [{ id: 'MLB123', title: 'Teste' }],
      },
      results_count: 1,
      with_sales_count: 0,
      notes: 'turbo',
      tenant_id: 'ambicorpmestre1',
    }

    try {
      const resWithoutAuth = $http.send({
        url: 'http://127.0.0.1:8090/api/collections/ml_collector_imports/records',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Collector-Key': 'mlk_12ejpmlcmtxmhy48n7tv',
        },
        body: JSON.stringify(payloadBody),
      })
      console.log(
        '[probe 0579] POST SEM auth header -> status:',
        resWithoutAuth.statusCode,
        'body:',
        resWithoutAuth.raw,
      )
    } catch (e1) {
      console.log('[probe 0579] POST SEM auth header -> erro:', e1)
    }

    // Agora com col.createRule = ''
    col.createRule = ''
    app.save(col)
    console.log('[probe 0579] col.createRule alterada para ""')

    try {
      const resWithPublicRule = $http.send({
        url: 'http://127.0.0.1:8090/api/collections/ml_collector_imports/records',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Collector-Key': 'mlk_12ejpmlcmtxmhy48n7tv',
        },
        body: JSON.stringify(payloadBody),
      })
      console.log(
        '[probe 0579] POST COM createRule="" -> status:',
        resWithPublicRule.statusCode,
        'body:',
        resWithPublicRule.raw,
      )
    } catch (e2) {
      console.log('[probe 0579] POST COM createRule="" -> erro:', e2)
    }
  },
  (app) => {},
)
