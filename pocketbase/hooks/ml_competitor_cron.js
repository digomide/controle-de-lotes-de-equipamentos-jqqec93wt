// Cron agendado para o Radar de Concorrência do Mercado Livre
// Executa a cada 4 horas: '0 */4 * * *'
// Varre todos os concorrentes ativos e atualiza seus anúncios, gerando eventos e histórico de preços

cronAdd('ml_competitor_radar_scheduler', '0 */4 * * *', () => {
  const nowIso = new Date().toISOString()
  console.log('[ml_competitor_cron] Iniciando varredura periódica de concorrência: ' + nowIso)

  try {
    const activeCompetitors = $app.findRecordsByFilter(
      'ml_competitors',
      'active = true',
      '-created',
      50,
      0,
    )
    if (!activeCompetitors || activeCompetitors.length === 0) {
      console.log('[ml_competitor_cron] Nenhum concorrente ativo cadastrado.')
      return
    }

    // Criar um job na fila ml_competitor_jobs para aproveitar a lógica assíncrona com timeout e log estruturado
    const jobsCol = $app.findCollectionByNameOrId('ml_competitor_jobs')
    const job = new Record(jobsCol)
    job.set('action', 'sync_all')
    job.set('status', 'pending')
    job.set('query', 'auto_cron_radar')
    $app.save(job)
    console.log('[ml_competitor_cron] Job agendado disparado com sucesso: ' + job.id)
  } catch (err) {
    console.log('[ml_competitor_cron] Erro ao disparar varredura periódica: ' + err)
  }
})
