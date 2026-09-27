/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('ml_settings')
    if (!collection) return

    // Adicionar campo 'scopes' do tipo text caso não exista
    let hasScopes = false
    try {
      const field = collection.fields.getByName('scopes')
      if (field) hasScopes = true
    } catch (_) {}

    if (!hasScopes) {
      collection.fields.add(
        new TextField({
          name: 'scopes',
          required: false,
        }),
      )
      app.save(collection)
    }

    // Preencher registro mestre atual com os escopos identificados pelo diagnóstico
    try {
      const settings = app.findFirstRecordByFilter('ml_settings', 'tenant_id = "ambicorpmestre1"')
      if (settings && !settings.getString('scopes')) {
        // Escopos atuais reais descobertos no diagnóstico
        const currentKnownScopes =
          'urn:ml:mktp:comunication:/read-only urn:ml:mktp:publish-sync:/read-only urn:ml:mktp:ads:/read-only urn:ml:mktp:invoices:/read-only urn:ml:mktp:metrics:/read-only urn:ml:mktp:offers:/read-only urn:ml:mktp:orders-shipments:/read-only offline_access read'
        settings.set('scopes', currentKnownScopes)
        app.save(settings)
      }
    } catch (e) {
      console.log('[0566_migration] Aviso ao atualizar scopes iniciais: ' + e)
    }
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('ml_settings')
      if (collection) {
        collection.fields.removeByName('scopes')
        app.save(collection)
      }
    } catch (_) {}
  },
)
