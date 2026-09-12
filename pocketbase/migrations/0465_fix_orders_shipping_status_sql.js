/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // Reverter de delivered para pending em todos os pedidos que possuem a tag not_delivered
    // Via SQL direto para garantir execução imediata e sem sobrecarga
    try {
      // 1. Atualizar via SQL: onde tags contém "not_delivered" e shipping_status = "delivered"
      // SQLite json_each ou LIKE:
      const res = app
        .db()
        .newQuery(
          "UPDATE ml_orders SET shipping_status = 'pending' WHERE tags LIKE '%not_delivered%' AND shipping_status IN ('delivered', 'shipped')",
        )
        .execute()

      console.log('[0465] SQL UPDATE em ml_orders executado para pedidos not_delivered')
    } catch (err) {
      console.log('[0465] Erro ao executar UPDATE SQL em ml_orders: ' + err)
    }
  },
  (app) => {},
)
