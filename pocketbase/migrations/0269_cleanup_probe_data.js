migrate(
  (app) => {
    // 0269: Limpar campo error_message do job 6pvxq95tk84npc0 agora que a evidência foi coletada
    try {
      const job = app.findRecordById('ml_catalog_search_jobs', '6pvxq95tk84npc0')
      job.set('error_message', '')
      app.save(job)
    } catch (_) {}
    // Limpar jobs de teste temporários criados nas migrações de probe se existirem
    try {
      const diagJob = app.findRecordById('ml_catalog_search_jobs', 'l077xtfs7tql82h')
      app.delete(diagJob)
    } catch (_) {}
  },
  (app) => {},
)
