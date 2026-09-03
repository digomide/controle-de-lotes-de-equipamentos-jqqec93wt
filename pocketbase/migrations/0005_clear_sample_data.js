migrate(
  (app) => {
    // 1. Remove sale_items and sales created in sample data or testing
    try {
      app.db().newQuery('DELETE FROM sale_items').execute()
    } catch (_) {}

    try {
      app.db().newQuery('DELETE FROM sales').execute()
    } catch (_) {}

    // 2. Remove inventory_adjustments
    try {
      app.db().newQuery('DELETE FROM inventory_adjustments').execute()
    } catch (_) {}

    // 3. Remove equipment_parts and equipment_deliverables
    try {
      app.db().newQuery('DELETE FROM equipment_parts').execute()
    } catch (_) {}

    try {
      app.db().newQuery('DELETE FROM equipment_deliverables').execute()
    } catch (_) {}

    // 4. Remove batches
    try {
      app.db().newQuery('DELETE FROM batches').execute()
    } catch (_) {}

    // 5. Remove products
    try {
      app.db().newQuery('DELETE FROM products').execute()
    } catch (_) {}

    // 6. Remove test / sample user 'vendedor@skip.internal' while PRESERVING admin 'rodrigoifgx@gmail.com'
    try {
      const vendedor = app.findAuthRecordByEmail('_pb_users_auth_', 'vendedor@skip.internal')
      app.delete(vendedor)
    } catch (_) {}

    // 7. Ensure admin rodrigoifgx@gmail.com exists, verified, and with role 'admin'
    try {
      const admin = app.findAuthRecordByEmail('_pb_users_auth_', 'rodrigoifgx@gmail.com')
      admin.set('role', 'admin')
      admin.setVerified(true)
      app.save(admin)
    } catch (_) {
      const users = app.findCollectionByNameOrId('_pb_users_auth_')
      const admin = new Record(users)
      admin.setEmail('rodrigoifgx@gmail.com')
      admin.setPassword('Skip@Pass')
      admin.setVerified(true)
      admin.set('name', 'Rodrigo Admin')
      admin.set('role', 'admin')
      app.save(admin)
    }
  },
  (app) => {
    // Down migration: clean-up only, no recreate needed
  },
)
