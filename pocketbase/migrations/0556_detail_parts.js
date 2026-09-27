// Detalhar seções específicas do TEXT_MLB7566367408
migrate(
  (app) => {
    const diag = app.findFirstRecordByFilter('ml_item_queue', 'ml_item_id="DIAGNOSTIC_PROMO_403"')
    if (!diag) return
    let parsed = null
    try {
      parsed = JSON.parse(diag.getString('result'))
    } catch (e) {
      parsed = diag.get('result')
    }

    const qCol = app.findCollectionByNameOrId('ml_item_queue')
    const it1 =
      parsed && parsed.items && parsed.items['MLB7566367408'] ? parsed.items['MLB7566367408'] : {}

    // 1. Promoções do item MLB7566367408
    const rPromo = new Record(qCol)
    rPromo.set('ml_item_id', 'PROMO_MLB7566367408')
    rPromo.set('action', 'update_price')
    rPromo.set('status', 'done')
    rPromo.set('error_message', JSON.stringify(it1.promotions || {}).substring(0, 1500))
    app.save(rPromo)

    // 2. PUT test do item MLB7566367408 (Body e Headers do 403)
    const rPut = new Record(qCol)
    rPut.set('ml_item_id', 'PUT_MLB7566367408')
    rPut.set('action', 'update_price')
    rPut.set('status', 'done')
    rPut.set('error_message', JSON.stringify(it1.put_test || {}).substring(0, 1500))
    app.save(rPut)

    // 3. User promos
    const rUser = new Record(qCol)
    rUser.set('ml_item_id', 'USER_PROMOS_DETAIL')
    rUser.set('action', 'update_price')
    rUser.set('status', 'done')
    rUser.set(
      'error_message',
      JSON.stringify(parsed ? parsed.user_promotions : {}).substring(0, 1500),
    )
    app.save(rUser)
  },
  (app) => {},
)
