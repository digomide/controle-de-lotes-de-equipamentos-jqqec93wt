// Migração de extração formatada do resultado do diagnóstico
migrate(
  (app) => {
    const diag = app.findFirstRecordByFilter('ml_item_queue', 'ml_item_id="DIAGNOSTIC_PROMO_403"')
    if (!diag) return

    const res = diag.get('result') || {}

    // Salvar user_promotions em um record separado mais curto
    const qCol = app.findCollectionByNameOrId('ml_item_queue')

    const recUser = new Record(qCol)
    recUser.set('ml_item_id', 'DIAG_USER_PROMOS')
    recUser.set('action', 'update_price')
    recUser.set('status', 'done')
    recUser.set('result', res.user_promotions || {})
    app.save(recUser)

    const items = res.items || {}
    const targetIds = ['MLB7566367408', 'MLB7566510008', 'MLB5193740831']

    for (let i = 0; i < targetIds.length; i++) {
      const id = targetIds[i]
      const recItem = new Record(qCol)
      recItem.set('ml_item_id', 'DIAG_' + id)
      recItem.set('action', 'update_price')
      recItem.set('status', 'done')
      recItem.set('result', items[id] || {})
      app.save(recItem)
    }
  },
  (app) => {},
)
