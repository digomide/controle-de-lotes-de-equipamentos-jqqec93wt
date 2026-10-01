/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // Probe: simular POST HTTP via $http.send ou criar diretamente e checar validação
    const col = app.findCollectionByNameOrId('ml_collector_imports')
    console.log('[probe 0576] Testando validações de ml_collector_imports')

    // 1. O que acontece se salvar com Record(col)?
    const rec = new Record(col)
    rec.set('search_term', 'fone de ouvido para capacete tomate')
    rec.set('tenant_id', 'ambicorpmestre1')
    rec.set('notes', 'auto')
    rec.set('results_count', 10)
    rec.set('with_sales_count', 5)
    rec.set('imported_at', new Date().toISOString())
    rec.set('payload', { version: '1.1.0', results: [] })

    try {
      app.save(rec)
      console.log('[probe 0576] app.save funcionou! ID:', rec.id)
      app.delete(rec)
    } catch (e) {
      console.log('[probe 0576] app.save falhou:', e)
    }

    // 2. Agora testar chamada HTTP local ou validação de form
    try {
      const res = $http.send({
        url: 'http://127.0.0.1:8090/api/collections/ml_collector_imports/records',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Collector-Key': 'mlk_12ejpmlcmtxmhy48n7tv',
        },
        body: JSON.stringify({
          search_term: 'fone de ouvido para capacete tomate',
          source_url: 'https://lista.mercadolivre.com.br/fone-de-ouvido-para-capacete-tomate',
          imported_at: new Date().toISOString(),
          payload: {
            version: '1.1.0',
            source: 'auto',
            search_term: 'fone de ouvido para capacete tomate',
            results: [{ id: 'MLB123', title: 'Teste' }],
          },
          results_count: 1,
          with_sales_count: 0,
          notes: 'auto',
          tenant_id: 'ambicorpmestre1',
        }),
      })
      console.log('[probe 0576] HTTP POST status:', res.statusCode, 'body:', res.raw)
    } catch (httpErr) {
      console.log('[probe 0576] HTTP POST erro:', httpErr)
    }
  },
  (app) => {},
)
