/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // Desafogar o banco SQLite imediatamente:
    // O histórico antigo de buscas não precisa ser recuperado (especificado no prompt).
    // Truncar o campo 'results' de registros antigos de ml_catalog_search_jobs para '[]',
    // mantendo status, query, created, updated e paging intactos.
    try {
      app
        .db()
        .newQuery(`
        UPDATE ml_catalog_search_jobs
        SET results = '[]',
            raw_debug = '[]'
        WHERE length(results) > 2000
      `)
        .execute()
      console.log('[0443] Truncados payloads pesados legados de ml_catalog_search_jobs')
    } catch (eTrunc) {
      console.warn('[0443] Aviso ao truncar resultados pesados legados:', eTrunc)
    }

    // Cancelar qualquer job antigo que ainda estivesse emperrado em pending ou processing
    try {
      app
        .db()
        .newQuery(`
        UPDATE ml_catalog_search_jobs
        SET status = 'error',
            error_message = 'Job anterior resetado para descompressão do banco de dados.',
            progress_text = 'Reinicie a busca para processamento leve.'
        WHERE status IN ('pending', 'processing')
      `)
        .execute()
      console.log('[0443] Jobs pendentes antigos resetados com sucesso')
    } catch (ePending) {
      console.warn('[0443] Aviso ao resetar jobs pendentes:', ePending)
    }
  },
  (app) => {},
)
