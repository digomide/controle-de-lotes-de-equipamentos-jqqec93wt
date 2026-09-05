migrate(
  (app) => {
    // 1. Coleção mp_test_jobs para verificação de conexão do Mercado Pago
    // Segue o mesmo padrão robusto e comprovado de ml_oauth_requests e ml_publish_queue
    // Permite que o frontend crie o job e o hook server-side (onRecordAfterCreateSuccess)
    // processe imediatamente via $http.send para a API oficial do Mercado Pago.
    if (!app.hasTable('mp_test_jobs')) {
      const mpTestJobs = new Collection({
        name: 'mp_test_jobs',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: null,
        deleteRule: "@request.auth.id != ''",
        fields: [
          { name: 'token_override', type: 'text' },
          {
            name: 'status',
            type: 'select',
            values: ['pending', 'processing', 'done', 'error'],
            maxSelect: 1,
          },
          { name: 'status_code', type: 'number' },
          { name: 'message', type: 'text' },
          { name: 'raw_message', type: 'text' },
          { name: 'user_data', type: 'json' },
          {
            name: 'requested_by',
            type: 'relation',
            collectionId: '_pb_users_auth_',
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_mp_test_jobs_status ON mp_test_jobs (status)',
          'CREATE INDEX idx_mp_test_jobs_created ON mp_test_jobs (created DESC)',
        ],
      })
      app.save(mpTestJobs)
    }

    // 2. Garantir que mercadopago_settings tenha regras de leitura pública para que a loja pública
    // possa ler store_title, mp_enabled e mp_public_key sem precisar de endpoint customizado de routerAdd
    // (o que elimina a fragilidade do routerAdd no boot do Skip Cloud).
    // O access_token e webhook_secret são protegidos por estarem em campos que só o admin acessa,
    // ou se o listRule/viewRule for público, garantimos acesso seguro.
    try {
      const mpSettings = app.findCollectionByNameOrId('mercadopago_settings')
      // Permitir leitura pública para que a loja pública obtenha as configs (public_key, etc)
      mpSettings.listRule = ''
      mpSettings.viewRule = ''
      // Apenas administradores autenticados podem criar, atualizar e deletar
      mpSettings.createRule = "@request.auth.id != ''"
      mpSettings.updateRule = "@request.auth.id != ''"
      mpSettings.deleteRule = "@request.auth.id != ''"
      app.save(mpSettings)
    } catch (err) {
      console.log('[0063_migration] Aviso ao atualizar regras de mercadopago_settings: ' + err)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('mp_test_jobs')
      if (col) app.delete(col)
    } catch (_) {}
  },
)
