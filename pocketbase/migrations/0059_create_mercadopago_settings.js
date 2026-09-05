migrate(
  (app) => {
    // 1. Coleção mercadopago_settings para credenciais do Mercado Pago
    const mpSettings = new Collection({
      name: 'mercadopago_settings',
      type: 'base',
      // Permite leitura pública apenas se necessário pelo front, mas para segurança de credenciais:
      // Apenas autenticado lê e escreve tokens. Endpoint público de preferência e status pode ler no backend com $app.
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'mp_access_token', type: 'text' },
        { name: 'mp_public_key', type: 'text' },
        { name: 'mp_enabled', type: 'bool' }, // Never required on bool in PB
        { name: 'store_title', type: 'text' },
        { name: 'statement_descriptor', type: 'text' },
        { name: 'webhook_secret', type: 'text' },
        { name: 'notes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(mpSettings)

    // Seed vazio idempotente
    try {
      const existing = app.findRecordsByFilter('mercadopago_settings', '1=1', '', 1, 0)
      if (!existing || existing.length === 0) {
        const record = new Record(mpSettings)
        record.set('mp_access_token', '')
        record.set('mp_public_key', '')
        record.set('mp_enabled', false)
        record.set('store_title', 'AMbicorpFlow Store')
        record.set('statement_descriptor', 'AMBICORPFLOW')
        record.set('webhook_secret', '')
        record.set('notes', 'Configuração inicial do Mercado Pago Checkout Pro')
        app.save(record)
      }
    } catch (seedErr) {
      console.log('Aviso ao inicializar seed de mercadopago_settings: ' + seedErr)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('mercadopago_settings')
      app.delete(col)
    } catch (_) {}
  },
)
