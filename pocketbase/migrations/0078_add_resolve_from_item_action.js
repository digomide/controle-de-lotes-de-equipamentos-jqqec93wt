migrate(
  (app) => {
    // 0078_add_resolve_from_item_action.js
    // Adiciona 'resolve_from_item' à lista de valores aceitos do campo 'action' em ml_competitor_jobs
    try {
      const col = app.findCollectionByNameOrId('ml_competitor_jobs')
      const actionField = col.fields.getByName('action')
      if (actionField) {
        const currentVals = actionField.values || []
        if (!currentVals.includes('resolve_from_item')) {
          actionField.values = [...currentVals, 'resolve_from_item']
          app.save(col)
        }
      }
    } catch (err) {
      console.log('[0078_add_resolve_from_item_action] Erro ao atualizar campo action: ' + err)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('ml_competitor_jobs')
      const actionField = col.fields.getByName('action')
      if (actionField && actionField.values) {
        actionField.values = actionField.values.filter((v) => v !== 'resolve_from_item')
        app.save(col)
      }
    } catch (_) {}
  },
)
