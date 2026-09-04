migrate(
  (app) => {
    const productsCol = app.findCollectionByNameOrId('products')

    // Add condition_type: novo, usado, recondicionado, caixa_aberta
    if (!productsCol.fields.getByName('condition_type')) {
      productsCol.fields.add(
        new SelectField({
          name: 'condition_type',
          required: false,
          maxSelect: 1,
          values: ['novo', 'usado', 'recondicionado', 'caixa_aberta'],
        }),
      )
    }

    // Add condition_grade: excelente, bom, aceitavel
    if (!productsCol.fields.getByName('condition_grade')) {
      productsCol.fields.add(
        new SelectField({
          name: 'condition_grade',
          required: false,
          maxSelect: 1,
          values: ['excelente', 'bom', 'aceitavel'],
        }),
      )
    }

    app.save(productsCol)

    // Migrate existing products (12 notebooks)
    // Map current condition ("Excelente", "Bom", "Regular", etc.)
    // Products in our inventory are corporate laptops (reconditioned/refurbished or used).
    // As per task: "Tipos de produto: Novo · Usado · Recondicionado · Caixa aberta.
    // Grau de estado (obrigatório para recondicionados, também exibido para usados):
    // Excelente (marcas de uso sutis, tela sem detalhes) · Bom (marcas pequenas, tela sem detalhes) · Aceitável (marcas visíveis, tela arranhada/riscada).
    // Migrar os dados existentes preservando o sentido atual das fichas (12 notebooks reais; ex.: registros com "Excelente" hoje devem continuar exibindo Excelente).
    // Manter compatibilidade com telas que leem o campo antigo."
    const products = app.findRecordsByFilter('products', '', '', 100, 0)
    for (const record of products) {
      const cond = (record.get('condition') || '').toString().toLowerCase().trim()
      const aesthetic = (record.get('aesthetic_grade') || '').toString().toLowerCase().trim()

      let grade = 'bom'
      if (
        cond.includes('excelente') ||
        aesthetic.includes('excelente') ||
        aesthetic.startsWith('a')
      ) {
        grade = 'excelente'
      } else if (
        cond.includes('aceitavel') ||
        cond.includes('regular') ||
        aesthetic.includes('regular') ||
        aesthetic.startsWith('c')
      ) {
        grade = 'aceitavel'
      } else {
        grade = 'bom'
      }

      // Default type for currently inventoried batch notebooks is 'recondicionado' (or 'usado')
      // Setting condition_type = 'recondicionado' with condition_grade = grade
      // Keep legacy condition field aligned (e.g. "Excelente", "Bom", "Aceitável")
      record.set('condition_type', 'recondicionado')
      record.set('condition_grade', grade)

      const legacyCond = grade === 'excelente' ? 'Excelente' : grade === 'bom' ? 'Bom' : 'Aceitável'
      record.set('condition', legacyCond)

      app.save(record)
    }
  },
  (app) => {
    const productsCol = app.findCollectionByNameOrId('products')
    if (productsCol.fields.getByName('condition_type')) {
      productsCol.fields.removeByName('condition_type')
    }
    if (productsCol.fields.getByName('condition_grade')) {
      productsCol.fields.removeByName('condition_grade')
    }
    app.save(productsCol)
  },
)
