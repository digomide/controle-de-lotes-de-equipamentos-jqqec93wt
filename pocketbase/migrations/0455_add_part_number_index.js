migrate(
  (app) => {
    try {
      const products = app.findCollectionByNameOrId('products')
      if (products) {
        // Garantir que o campo part_number existe na coleção products
        if (!products.fields.getByName('part_number')) {
          products.fields.add(
            new TextField({
              name: 'part_number',
              required: false,
            }),
          )
        }

        // Adicionar índice para acelerar consultas e buscas por part_number
        const indexes = products.indexes || []
        const hasPnIndex = indexes.some((idx) => idx.includes('idx_products_part_number'))
        if (!hasPnIndex) {
          products.indexes = [
            ...indexes,
            'CREATE INDEX idx_products_part_number ON products (part_number)',
          ]
        }

        app.save(products)
      }
    } catch (err) {
      console.log('[0455_add_part_number_index] Erro: ' + err)
      throw err
    }
  },
  (app) => {
    try {
      const products = app.findCollectionByNameOrId('products')
      if (products) {
        const indexes = products.indexes || []
        products.indexes = indexes.filter((idx) => !idx.includes('idx_products_part_number'))
        app.save(products)
      }
    } catch (_) {}
  },
)
