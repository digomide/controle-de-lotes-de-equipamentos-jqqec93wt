// Extrair detalhes como string de texto no campo error_message
migrate(
  (app) => {
    const diag = app.findFirstRecordByFilter('ml_item_queue', 'ml_item_id="DIAGNOSTIC_PROMO_403"')
    if (!diag) return

    // No PocketBase JS VM, get('result') é tipo json/any
    const rawResult = diag.getString('result')
    let parsed = null
    try {
      parsed = JSON.parse(rawResult)
    } catch (e) {
      parsed = diag.get('result')
    }

    const qCol = app.findCollectionByNameOrId('ml_item_queue')

    // Para MLB7566367408
    const it1 =
      parsed && parsed.items && parsed.items['MLB7566367408'] ? parsed.items['MLB7566367408'] : null
    const rec1 = new Record(qCol)
    rec1.set('ml_item_id', 'TEXT_MLB7566367408')
    rec1.set('action', 'update_price')
    rec1.set('status', 'done')
    rec1.set('error_message', JSON.stringify(it1).substring(0, 1000))
    app.save(rec1)

    // Para MLB7566510008
    const it2 =
      parsed && parsed.items && parsed.items['MLB7566510008'] ? parsed.items['MLB7566510008'] : null
    const rec2 = new Record(qCol)
    rec2.set('ml_item_id', 'TEXT_MLB7566510008')
    rec2.set('action', 'update_price')
    rec2.set('status', 'done')
    rec2.set('error_message', JSON.stringify(it2).substring(0, 1000))
    app.save(rec2)

    // Para MLB5193740831
    const it3 =
      parsed && parsed.items && parsed.items['MLB5193740831'] ? parsed.items['MLB5193740831'] : null
    const rec3 = new Record(qCol)
    rec3.set('ml_item_id', 'TEXT_MLB5193740831')
    rec3.set('action', 'update_price')
    rec3.set('status', 'done')
    rec3.set('error_message', JSON.stringify(it3).substring(0, 1000))
    app.save(rec3)

    // Para user promos
    const up = parsed ? parsed.user_promotions : null
    const recUp = new Record(qCol)
    recUp.set('ml_item_id', 'TEXT_USER_PROMOS')
    recUp.set('action', 'update_price')
    recUp.set('status', 'done')
    recUp.set('error_message', JSON.stringify(up).substring(0, 1000))
    app.save(recUp)
  },
  (app) => {},
)
