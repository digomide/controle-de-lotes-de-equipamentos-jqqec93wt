/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // Vamos testar o validador interno de cada campo de ml_collector_imports
    const col = app.findCollectionByNameOrId('ml_collector_imports')
    const snapCol = app.findCollectionByNameOrId('ml_ad_snapshots')

    // Cenários a testar:
    // 1. O que acontece quando tenant_id é passado como string 'ambicorpmestre1'?
    // 2. O que acontece quando imported_at é passado como '2026-10-01T05:26:40.982Z'?
    // 3. O que acontece quando results_count é número ou string?
    // 4. O que acontece quando payload é uma string JSON vs objeto?
    // 5. O que acontece se payload contiver caracteres especiais ou for grande?

    const results = []

    // Teste A: Record com Record(col).load(data)
    const testDataA = {
      search_term: 'fone de ouvido para capacete tomate',
      source_url: 'https://lista.mercadolivre.com.br/fone-de-ouvido-para-capacete-tomate',
      imported_at: '2026-10-01 05:26:40.982Z',
      payload: { version: '1.1.0', results: [] },
      results_count: 10,
      with_sales_count: 5,
      notes: 'turbo',
      tenant_id: 'ambicorpmestre1',
    }

    try {
      const rec = new Record(col)
      rec.load(testDataA)
      app.save(rec)
      app.delete(rec)
      results.push('Test A (load): OK')
    } catch (eA) {
      results.push('Test A (load) FAIL: ' + JSON.stringify(eA))
    }

    // Teste B: Record com payload sendo STRING
    try {
      const rec = new Record(col)
      rec.load({
        ...testDataA,
        payload: JSON.stringify({ version: '1.1.0', results: [] }),
      })
      app.save(rec)
      app.delete(rec)
      results.push('Test B (string payload): OK')
    } catch (eB) {
      results.push('Test B (string payload) FAIL: ' + JSON.stringify(eB))
    }

    // Teste C: Record com imported_at em ISO 8601 com 'T'
    try {
      const rec = new Record(col)
      rec.load({
        ...testDataA,
        imported_at: '2026-10-01T05:26:40.982Z',
      })
      app.save(rec)
      app.delete(rec)
      results.push('Test C (ISO T date): OK')
    } catch (eC) {
      results.push('Test C (ISO T date) FAIL: ' + JSON.stringify(eC))
    }

    // Teste D: Form validation! Em PocketBase v0.23+/v0.36, como os requests HTTP validam?
    // Eles usam forms.RecordUpsert ou Record.validate() ou similar
    // Vamos checar se Record tem método validate
    try {
      const rec = new Record(col)
      rec.load(testDataA)
      if (typeof rec.validate === 'function') {
        const vErr = rec.validate()
        results.push('rec.validate(): ' + JSON.stringify(vErr))
      } else {
        results.push('rec.validate não é função')
      }
    } catch (eV) {
      results.push('rec.validate erro: ' + eV)
    }

    // Teste E: Record com results_count como string '10' (como pode vir se vier de form/query)
    try {
      const rec = new Record(col)
      rec.load({
        ...testDataA,
        results_count: '10',
        with_sales_count: '5',
      })
      app.save(rec)
      app.delete(rec)
      results.push('Test E (string counts): OK')
    } catch (eE) {
      results.push('Test E (string counts) FAIL: ' + JSON.stringify(eE))
    }

    const snap = new Record(snapCol)
    snap.set('item_id', 'PROBE0582')
    snap.set('title', 'Probe 0582 Results')
    snap.set('seller_nickname', results.join(' | ').substring(0, 250))
    snap.set('snapshot_date', new Date().toISOString())
    snap.set('tenant_id', 'ambicorpmestre1')
    app.save(snap)
  },
  (app) => {},
)
