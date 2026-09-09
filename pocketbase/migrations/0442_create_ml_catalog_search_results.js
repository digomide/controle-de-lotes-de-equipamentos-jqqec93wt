/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Criar coleção ml_catalog_search_results para armazenar os blocos (chunks)
    // de resultados quando a busca for grande ou enriquecida com concorrentes
    if (!app.hasTable('ml_catalog_search_results')) {
      const resultsCol = new Collection({
        name: 'ml_catalog_search_results',
        type: 'base',
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.id != ""',
        deleteRule: '@request.auth.id != ""',
        fields: [
          {
            name: 'job_id',
            type: 'text',
            required: true,
          },
          {
            name: 'chunk_index',
            type: 'number',
            required: true,
            onlyInt: true,
          },
          {
            name: 'items_count',
            type: 'number',
            required: false,
            onlyInt: true,
          },
          {
            name: 'payload_json',
            type: 'json',
            required: true,
          },
          {
            name: 'created',
            type: 'autodate',
            onCreate: true,
            onUpdate: false,
          },
          {
            name: 'updated',
            type: 'autodate',
            onCreate: true,
            onUpdate: true,
          },
        ],
        indexes: [
          'CREATE INDEX idx_ml_catalog_search_results_job ON ml_catalog_search_results (job_id, chunk_index ASC)',
        ],
      })
      app.save(resultsCol)
      console.log('[0442] Criada colecao ml_catalog_search_results com sucesso')
    }

    // 2. Adicionar campo has_chunks e chunk_count na coleção ml_catalog_search_jobs se não existirem
    try {
      const jobsCol = app.findCollectionByNameOrId('ml_catalog_search_jobs')
      let changed = false
      if (!jobsCol.fields.getByName('has_chunks')) {
        jobsCol.fields.add(
          new BoolField({
            name: 'has_chunks',
            required: false,
          }),
        )
        changed = true
      }
      if (!jobsCol.fields.getByName('chunk_count')) {
        jobsCol.fields.add(
          new NumberField({
            name: 'chunk_count',
            required: false,
            onlyInt: true,
          }),
        )
        changed = true
      }
      if (changed) {
        app.save(jobsCol)
        console.log('[0442] Adicionados campos has_chunks e chunk_count em ml_catalog_search_jobs')
      }
    } catch (eCol) {
      console.warn('[0442] Aviso ao estender ml_catalog_search_jobs:', eCol)
    }

    // 3. Limpeza / Manutenção Segura:
    // Destravar jobs emperrados em 'pending' ou 'processing' com mais de 15 minutos
    try {
      const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000)
        .toISOString()
        .replace('T', ' ')
        .substring(0, 19)
      app
        .db()
        .newQuery(`
        UPDATE ml_catalog_search_jobs
        SET status = 'error',
            error_message = 'Busca expirada ou interrompida por sobrecarga anterior. Pode ser repetida com a nova arquitetura.',
            progress_text = 'Essa busca anterior expirou ou falhou. Execute uma nova pesquisa.'
        WHERE status IN ('pending', 'processing')
          AND created < {:cutoff}
      `)
        .bind({ cutoff: fifteenMinAgo })
        .execute()
      console.log('[0442] Jobs emperrados antigos marcados como error com sucesso')
    } catch (eStuck) {
      console.warn('[0442] Aviso ao limpar jobs emperrados:', eStuck)
    }

    // 4. Se houver jobs concluídos muito antigos (> 7 dias) cujo campo results seja gigante (>500KB),
    // truncar apenas o JSON armazenado desses registros antigos para aliviar o banco e evitar context deadline exceeded
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 1000)
        .toISOString()
        .replace('T', ' ')
        .substring(0, 19)
      app
        .db()
        .newQuery(`
        UPDATE ml_catalog_search_jobs
        SET results = '[]',
            raw_debug = '[]'
        WHERE created < {:cutoff}
          AND length(results) > 500000
      `)
        .bind({ cutoff: sevenDaysAgo })
        .execute()
      console.log('[0442] Truncados payloads gigantes de jobs com mais de 7 dias')
    } catch (eTrunc) {
      console.warn('[0442] Aviso ao truncar jobs gigantes antigos:', eTrunc)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('ml_catalog_search_results')
      if (col) app.delete(col)
    } catch (_) {}
  },
)
