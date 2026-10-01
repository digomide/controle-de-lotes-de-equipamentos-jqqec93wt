/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('ml_collector_imports')
    const keyRec = app.findFirstRecordByFilter(
      'ml_collector_keys',
      "key = 'mlk_12ejpmlcmtxmhy48n7tv' && active = true",
    )
    console.log('[0577] Chave encontrada:', keyRec ? keyRec.id : 'NENHUMA')

    // Testar validação direta com Record(col) passando string e objeto
    const testCases = [
      {
        name: 'Objeto JS normal',
        payload: { results: [{ id: '1' }] },
      },
      {
        name: 'String JSON',
        payload: JSON.stringify({ results: [{ id: '1' }] }),
      },
      {
        name: 'Campos vazios / undefined',
        payload: { results: [] },
      },
    ]

    for (const tc of testCases) {
      try {
        const r = new Record(col)
        r.set('search_term', 'teste ' + tc.name)
        r.set('tenant_id', 'ambicorpmestre1')
        r.set('payload', tc.payload)
        r.set('results_count', 1)
        r.set('with_sales_count', 0)
        r.set('notes', 'teste')
        r.set('imported_at', new Date().toISOString())
        app.save(r)
        app.delete(r)
        console.log('[0577] Sucesso:', tc.name)
      } catch (err) {
        console.log('[0577] Falha em', tc.name, ':', err)
      }
    }
  },
  (app) => {},
)
