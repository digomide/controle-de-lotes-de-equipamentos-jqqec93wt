migrate(
  (app) => {
    // Limpar jobs presos em 'processing' para não poluir o monitoramento
    app
      .db()
      .newQuery(`
      UPDATE ml_catalog_search_jobs
      SET status = 'error',
          error_message = 'Job encerrado: gravação de resultados anteriores excedeu o limite antes da normalização de payload.',
          progress_text = 'Erro ao salvar resultados da busca'
      WHERE status = 'processing'
    `)
      .execute()
  },
  (app) => {},
)
