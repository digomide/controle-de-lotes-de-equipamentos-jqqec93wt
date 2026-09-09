migrate(
  (app) => {
    try {
      const products = app.findCollectionByNameOrId('products')
      if (products) {
        // 1. Adicionar part_number se não existir
        if (!products.fields.getByName('part_number')) {
          products.fields.add(
            new TextField({
              name: 'part_number',
              required: false,
            }),
          )
        }

        // 2. Expandir valores aceitos de status para incluir 'Pendente de ativação'
        const statusField = products.fields.getByName('status')
        if (statusField) {
          const currentValues = statusField.values || []
          if (!currentValues.includes('Pendente de ativação')) {
            statusField.values = [...currentValues, 'Pendente de ativação']
          }
        }

        app.save(products)
      }
    } catch (err) {
      console.log('[0439_add_part_number_and_pending_status] Erro: ' + err)
      throw err
    }
  },
  (app) => {
    try {
      const products = app.findCollectionByNameOrId('products')
      if (products) {
        const pnField = products.fields.getByName('part_number')
        if (pnField) {
          products.fields.removeByName('part_number')
        }
        const statusField = products.fields.getByName('status')
        if (statusField && statusField.values) {
          statusField.values = statusField.values.filter((v) => v !== 'Pendente de ativação')
        }
        app.save(products)
      }
    } catch (_) {}
  },
)
