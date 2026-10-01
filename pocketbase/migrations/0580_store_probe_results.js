/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('ml_collector_imports')

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

    let statusSemAuth = 0
    let bodySemAuth = ''
    try {
      const res = $http.send({
        url: 'http://127.0.0.1:8090/api/collections/ml_collector_imports/records',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Collector-Key': 'mlk_12ejpmlcmtxmhy48n7tv',
        },
        body: JSON.stringify(payloadBody),
      })
      statusSemAuth = res.statusCode
      bodySemAuth = res.raw
    } catch (e) {
      bodySemAuth = String(e)
    }

    const snapCol = app.findCollectionByNameOrId('ml_ad_snapshots')
    const snap = new Record(snapCol)
    snap.set('item_id', 'PROBE0580')
    snap.set('title', 'Probe Status: ' + statusSemAuth)
    snap.set('seller_nickname', (bodySemAuth || '').substring(0, 100))
    snap.set('snapshot_date', new Date().toISOString())
    snap.set('tenant_id', 'ambicorpmestre1')
    app.save(snap)
  },
  (app) => {},
)
