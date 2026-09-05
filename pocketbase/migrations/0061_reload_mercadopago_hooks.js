migrate((app) => {
  // Migration to trigger schema/backend sync and ensure pb_hooks pool is completely reloaded
  const col = app.findCollectionByNameOrId('mercadopago_settings')
  app.save(col)
}, (app) => {})
