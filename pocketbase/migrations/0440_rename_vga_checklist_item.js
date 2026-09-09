migrate(
  (app) => {
    try {
      // Renomear "Revisão de VGA Dedicada" -> "VGA Dedicada" nos registros da coleção products
      const records = app.findRecordsByFilter(
        'products',
        "technical_checklist ~ 'Revisão de VGA Dedicada' || technical_checklist ~ 'VGA Dedicada'",
      )

      for (let i = 0; i < records.length; i++) {
        const record = records[i]
        const rawChecklist = record.get('technical_checklist')
        let checklistArr = []
        if (typeof rawChecklist === 'string') {
          try {
            checklistArr = JSON.parse(rawChecklist)
          } catch (_) {
            checklistArr = []
          }
        } else if (Array.isArray(rawChecklist)) {
          checklistArr = rawChecklist
        }

        let changed = false
        const updatedChecklist = checklistArr.map((item) => {
          if (item && item.item === 'Revisão de VGA Dedicada') {
            changed = true
            return {
              ...item,
              item: 'VGA Dedicada',
            }
          }
          return item
        })

        if (changed) {
          record.set('technical_checklist', updatedChecklist)
          app.save(record)
        }
      }
    } catch (err) {
      console.log('[0440_rename_vga_checklist_item] Erro: ' + err)
      throw err
    }
  },
  (app) => {
    try {
      const records = app.findRecordsByFilter('products', "technical_checklist ~ 'VGA Dedicada'")

      for (let i = 0; i < records.length; i++) {
        const record = records[i]
        const rawChecklist = record.get('technical_checklist')
        let checklistArr = []
        if (typeof rawChecklist === 'string') {
          try {
            checklistArr = JSON.parse(rawChecklist)
          } catch (_) {
            checklistArr = []
          }
        } else if (Array.isArray(rawChecklist)) {
          checklistArr = rawChecklist
        }

        let changed = false
        const revertedChecklist = checklistArr.map((item) => {
          if (item && item.item === 'VGA Dedicada') {
            changed = true
            return {
              ...item,
              item: 'Revisão de VGA Dedicada',
            }
          }
          return item
        })

        if (changed) {
          record.set('technical_checklist', revertedChecklist)
          app.save(record)
        }
      }
    } catch (_) {}
  },
)
