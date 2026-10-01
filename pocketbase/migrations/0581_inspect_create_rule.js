/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('ml_collector_imports')
    const snapCol = app.findCollectionByNameOrId('ml_ad_snapshots')
    const snap = new Record(snapCol)
    snap.set('item_id', 'PROBE0581')
    snap.set('title', 'col.createRule: ' + JSON.stringify(col.createRule))
    snap.set('seller_nickname', 'list:' + col.listRule + ' view:' + col.viewRule)
    snap.set('snapshot_date', new Date().toISOString())
    snap.set('tenant_id', 'ambicorpmestre1')
    app.save(snap)
  },
  (app) => {},
)
