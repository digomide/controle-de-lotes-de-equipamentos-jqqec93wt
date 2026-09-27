// Limpeza das records temporárias criadas durante o teste
migrate(
  (app) => {
    const idsToDelete = [
      'DIAGNOSTIC_PROMO_403',
      'DIAG_USER_PROMOS',
      'DIAG_MLB7566367408',
      'DIAG_MLB7566510008',
      'DIAG_MLB5193740831',
      'TEXT_MLB7566367408',
      'TEXT_MLB7566510008',
      'TEXT_MLB5193740831',
      'TEXT_USER_PROMOS',
      'PROMO_MLB7566367408',
      'PUT_MLB7566367408',
      'USER_PROMOS_DETAIL',
      'PROMOS_LIST',
      'ITEM_PROMO_MLB7566367408',
      'ITEM_PROMO_MLB7566510008',
      'ITEM_PROMO_MLB5193740831',
      'PUT_FULL_HEADERS',
    ]

    for (let i = 0; i < idsToDelete.length; i++) {
      try {
        const recs = app.findRecordsByFilter(
          'ml_item_queue',
          'ml_item_id="' + idsToDelete[i] + '"',
          '-created',
          10,
          0,
        )
        if (recs && recs.length > 0) {
          for (let j = 0; j < recs.length; j++) {
            app.delete(recs[j])
          }
        }
      } catch (_) {}
    }
  },
  (app) => {},
)
