/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // Desmarcar 'required' do campo chunk_index em ml_catalog_search_results
    // No PocketBase v0.36, campos NumberField com required=true rejeitam o valor 0 como em branco.
    // Embora o worker agora grave chunk_index iniciando em 1 (1-based),
    // remover a restrição required do campo elimina de vez qualquer armadilha futura com valor 0.
    try {
      const resultsCol = app.findCollectionByNameOrId('ml_catalog_search_results')
      if (resultsCol) {
        const field = resultsCol.fields.getByName('chunk_index')
        if (field) {
          field.required = false
          app.save(resultsCol)
          console.log('[0444] Removido required de chunk_index em ml_catalog_search_results')
        }
      }
    } catch (err) {
      console.warn('[0444] Erro ao atualizar chunk_index em ml_catalog_search_results:', err)
      throw err
    }
  },
  (app) => {
    try {
      const resultsCol = app.findCollectionByNameOrId('ml_catalog_search_results')
      if (resultsCol) {
        const field = resultsCol.fields.getByName('chunk_index')
        if (field) {
          field.required = true
          app.save(resultsCol)
        }
      }
    } catch (_) {}
  },
)
