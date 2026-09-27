/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 0565_clean_and_check_auth_scopes:
    // Limpar o registro de teste temporário bnun4b8qp6o1y0n
    try {
      const rec = app.findFirstRecordByFilter('ml_item_queue', 'id = "bnun4b8qp6o1y0n"')
      if (rec) app.delete(rec)
    } catch (_) {}
  },
  (app) => {},
)
