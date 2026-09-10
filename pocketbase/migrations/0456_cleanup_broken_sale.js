migrate(
  (app) => {
    // 1. Equipamentos baixados pela venda quebrada 2ijct55qkfh56qu
    const brokenProductIds = [
      '5ux43nl5v0wlj9r',
      '8qqi3dhl5m6sro3',
      'kkj2gzzue8r6dtr',
      'mu0o0ffjfls57bq',
      '4ubux2qgjxref8v',
      'x8blkgvjhc5iace',
      '55ya0w7kxy6uhi6',
      'b2n36b8roia0034',
      '0kmm5fxqo6z6215',
      '2eh4rb9uw4pqn8v',
      'kprx9ii4e88ls63',
      'k3qot8orxehqaum',
      'rx2hd0ml9whqhzk',
    ]

    for (let i = 0; i < brokenProductIds.length; i++) {
      const prodId = brokenProductIds[i]
      try {
        const prod = app.findRecordById('products', prodId)
        if (prod) {
          prod.set('status', 'Disponível')

          // Limpar histórico referente à venda quebrada
          let events = prod.get('history_events')
          if (typeof events === 'string') {
            try {
              events = JSON.parse(events)
            } catch (_) {
              events = []
            }
          } else if (!Array.isArray(events)) {
            events = []
          }

          // Filtrar eventos que mencionem a venda #2ijct5 ou 2ijct55qkfh56qu
          const filteredEvents = events.filter((ev) => {
            if (!ev || !ev.title) return true
            const title = String(ev.title)
            if (title.includes('2ijct5') || title.includes('2ijct55qkfh56qu')) {
              return false
            }
            return true
          })

          prod.set('history_events', filteredEvents)
          app.save(prod)
        }
      } catch (err) {
        console.log('[0456_cleanup_broken_sale] Erro ao restaurar produto ' + prodId + ': ' + err)
      }
    }

    // 2. Excluir os 13 sale_items vinculados à venda quebrada 2ijct55qkfh56qu
    try {
      const saleItems = app.findRecordsByFilter(
        'sale_items',
        "sale_id = '2ijct55qkfh56qu'",
        '',
        100,
        0,
      )
      for (let j = 0; j < saleItems.length; j++) {
        app.delete(saleItems[j])
      }
    } catch (err) {
      console.log('[0456_cleanup_broken_sale] Erro ao deletar sale_items: ' + err)
    }

    // 3. Excluir a venda quebrada 2ijct55qkfh56qu da coleção sales
    try {
      const saleRecord = app.findRecordById('sales', '2ijct55qkfh56qu')
      if (saleRecord) {
        app.delete(saleRecord)
      }
    } catch (err) {
      console.log('[0456_cleanup_broken_sale] Erro ao deletar venda: ' + err)
    }

    // 4. Limpar batches transitórios criados com location = 'Venda por Lote' para os 13 produtos
    for (let k = 0; k < brokenProductIds.length; k++) {
      const prodId = brokenProductIds[k]
      try {
        const batchRecords = app.findRecordsByFilter(
          'batches',
          "product_id = '" + prodId + "' && location = 'Venda por Lote'",
          '',
          10,
          0,
        )
        for (let b = 0; b < batchRecords.length; b++) {
          app.delete(batchRecords[b])
        }
      } catch (bErr) {
        console.log('[0456_cleanup_broken_sale] Erro limpando batch de ' + prodId + ': ' + bErr)
      }
    }
  },
  (app) => {},
)
