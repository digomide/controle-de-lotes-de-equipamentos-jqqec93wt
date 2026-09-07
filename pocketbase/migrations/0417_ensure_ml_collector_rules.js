migrate(
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('ml_collector_imports')
      if (col) {
        // Garantir que createRule seja pública ('') para permitir envio do coletor pelo navegador/userscript
        // O controle e validação de segurança são exercidos pelo hook onRecordCreateRequest com a chave X-Collector-Key
        col.createRule = ''
        col.listRule = ''
        col.viewRule = ''
        app.save(col)
      }
    } catch (e) {
      console.log('[migration 0417] Erro ao atualizar regras de ml_collector_imports: ' + e)
    }
  },
  (app) => {
    // down migration
  },
)
