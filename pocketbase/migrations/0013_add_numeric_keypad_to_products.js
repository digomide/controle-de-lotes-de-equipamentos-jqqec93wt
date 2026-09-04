migrate(
  (app) => {
    const productsCol = app.findCollectionByNameOrId('products')

    // Add has_numeric_keypad field if it doesn't already exist
    if (!productsCol.fields.getByName('has_numeric_keypad')) {
      productsCol.fields.add(
        new BoolField({
          name: 'has_numeric_keypad',
          required: false,
        }),
      )
      app.save(productsCol)
    }

    // Now populate existing products with screen_size and has_numeric_keypad based on their models/titles
    // Dell Inspiron 15-3576, 15-5566, 15-5557, 15-7572 -> 15.6" screen, 15-inch standard keyboard has numeric keypad
    // ThinkPad T580, P1 Gen2 -> 15.6" screen (T580 has numeric keypad; P1 Gen2 is centered keyboard without numeric keypad)
    // Latitude 5320, 5300, HP EliteBook 840 G4 -> 13.3" / 14", no numeric keypad
    const products = app.findRecordsByFilter('products', '', '', 100, 0)
    for (const record of products) {
      const name = (record.get('name') || '').toString()
      const model = (record.get('model') || '').toString()

      let screenSize = (record.get('screen_size') || '').toString()
      let hasNumeric = false

      // Screen size extraction if empty
      if (!screenSize) {
        if (name.includes('15.6"') || name.includes('15.6')) {
          screenSize = '15.6"'
        } else if (name.includes('14"') || name.includes('14')) {
          screenSize = '14"'
        } else if (name.includes('13.3"') || name.includes('13.3')) {
          screenSize = '13.3"'
        }
      }

      // Determine numeric keypad:
      // Dell Inspiron 15 series (15-3576, 15-5566, 15-5557, 15-7572) have full numeric keypads
      // Lenovo ThinkPad T580 has full numeric keypad
      // Lenovo ThinkPad P1 Gen 2 has NO numeric keypad (compact centered)
      // 14" and 13.3" laptops (Latitude 5300, 5320, HP 840 G4) have NO numeric keypad
      if (
        model.includes('3576') ||
        model.includes('5566') ||
        model.includes('5557') ||
        model.includes('7572') ||
        model.includes('T580') ||
        name.includes('Inspiron 15-3576') ||
        name.includes('Inspiron 15-5566') ||
        name.includes('Inspiron 15-5557') ||
        name.includes('Inspiron 15-7572') ||
        name.includes('ThinkPad T580')
      ) {
        hasNumeric = true
      }

      if (screenSize) {
        record.set('screen_size', screenSize)
      }
      record.set('has_numeric_keypad', hasNumeric)
      app.save(record)
    }
  },
  (app) => {
    const productsCol = app.findCollectionByNameOrId('products')
    const field = productsCol.fields.getByName('has_numeric_keypad')
    if (field) {
      productsCol.fields.removeByName('has_numeric_keypad')
      app.save(productsCol)
    }
  },
)
