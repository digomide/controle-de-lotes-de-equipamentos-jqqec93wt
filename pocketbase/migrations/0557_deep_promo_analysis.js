// Analisar campanhas do usuário e dos itens em profundidade
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

    // 1. Detalhe de seller_promotions_user
    const userResults =
      parsed &&
      parsed.user_promotions &&
      parsed.user_promotions.seller_promotions_user &&
      parsed.user_promotions.seller_promotions_user.body
        ? parsed.user_promotions.seller_promotions_user.body.results
        : []

    const rUserPromos = new Record(qCol)
    rUserPromos.set('ml_item_id', 'PROMOS_LIST')
    rUserPromos.set('action', 'update_price')
    rUserPromos.set('status', 'done')
    rUserPromos.set('error_message', JSON.stringify(userResults).substring(0, 1500))
    app.save(rUserPromos)

    // 2. Detalhes de promoções para cada um dos 3 itens:
    const targetIds = ['MLB7566367408', 'MLB7566510008', 'MLB5193740831']
    for (let i = 0; i < targetIds.length; i++) {
      const id = targetIds[i]
      const it = parsed && parsed.items && parsed.items[id] ? parsed.items[id] : {}
      const rec = new Record(qCol)
      rec.set('ml_item_id', 'ITEM_PROMO_' + id)
      rec.set('action', 'update_price')
      rec.set('status', 'done')
      // seller_promotions_item
      const spi =
        it.promotions && it.promotions.seller_promotions_item
          ? it.promotions.seller_promotions_item
          : {}
      const pr =
        it.promotions && it.promotions.items_promotions ? it.promotions.items_promotions : {}
      rec.set(
        'error_message',
        (
          'seller_promotions: ' +
          JSON.stringify(spi) +
          ' | items_promotions: ' +
          JSON.stringify(pr)
        ).substring(0, 1500),
      )
      app.save(rec)
    }

    // 3. Headers e causa completa do PUT no MLB7566367408
    const it1 =
      parsed && parsed.items && parsed.items['MLB7566367408'] ? parsed.items['MLB7566367408'] : {}
    const recPutDetail = new Record(qCol)
    recPutDetail.set('ml_item_id', 'PUT_FULL_HEADERS')
    recPutDetail.set('action', 'update_price')
    recPutDetail.set('status', 'done')
    recPutDetail.set(
      'error_message',
      JSON.stringify({
        put_body: it1.put_test ? it1.put_test.body : null,
        headers: it1.put_test ? it1.put_test.headers : null,
      }).substring(0, 1500),
    )
    app.save(recPutDetail)
  },
  (app) => {},
)
