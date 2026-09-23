migrate(
  (app) => {
    try {
      const parts = app.findCollectionByNameOrId('equipment_parts')
      if (parts) {
        // 1. Adicionar campo quantity (number) se não existir
        if (!parts.fields.getByName('quantity')) {
          parts.fields.add(
            new NumberField({
              name: 'quantity',
              required: false,
              min: 1,
            }),
          )
        }

        // 2. Expandir status aceitos para incluir estados de compra/fluxo de peças
        // Existentes: Pendente | Trocado | Instalado | Danificado
        // Novos requisitados: Orçada | Comprada | Recebida | Instalada (e manter legados para compatibilidade)
        const statusField = parts.fields.getByName('status')
        if (statusField) {
          const currentValues = statusField.values || []
          const desiredValues = [
            'Pendente',
            'Orçada',
            'Comprada',
            'Recebida',
            'Instalada',
            'Instalado',
            'Trocado',
            'Danificado',
          ]
          const combined = Array.from(new Set([...currentValues, ...desiredValues]))
          statusField.values = combined
        }

        app.save(parts)

        // 3. Backfill de quantity = 1 para registros que não tenham quantidade definida
        try {
          app
            .db()
            .newQuery(
              'UPDATE equipment_parts SET quantity = 1 WHERE quantity IS NULL OR quantity <= 0',
            )
            .execute()
        } catch (dbErr) {
          console.log(
            '[0505_add_quantity_and_statuses_to_equipment_parts] Backfill notice: ' + dbErr,
          )
        }
      }
    } catch (err) {
      console.log('[0505_add_quantity_and_statuses_to_equipment_parts] Erro: ' + err)
      throw err
    }
  },
  (app) => {
    try {
      const parts = app.findCollectionByNameOrId('equipment_parts')
      if (parts) {
        if (parts.fields.getByName('quantity')) {
          parts.fields.removeByName('quantity')
        }
        app.save(parts)
      }
    } catch (_) {}
  },
)
