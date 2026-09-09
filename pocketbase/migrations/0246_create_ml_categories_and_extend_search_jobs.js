migrate(
  (app) => {
    // 1. Atualizar ml_catalog_search_jobs com category_id, category_path, progress_count
    const searchJobs = app.findCollectionByNameOrId('ml_catalog_search_jobs')
    if (searchJobs) {
      if (!searchJobs.fields.getByName('category_id')) {
        searchJobs.fields.add(
          new TextField({
            name: 'category_id',
            required: false,
          }),
        )
      }
      if (!searchJobs.fields.getByName('category_path')) {
        searchJobs.fields.add(
          new TextField({
            name: 'category_path',
            required: false,
          }),
        )
      }
      if (!searchJobs.fields.getByName('progress_count')) {
        searchJobs.fields.add(
          new NumberField({
            name: 'progress_count',
            required: false,
          }),
        )
      }

      // Adicionar índice para busca de cache rápida sem escanear a tabela inteira
      try {
        searchJobs.indexes.push(
          'CREATE INDEX idx_ml_catalog_cache_lookup ON ml_catalog_search_jobs (status, query, condition, category_id, created DESC)',
        )
      } catch (_) {}

      app.save(searchJobs)
    }

    // 2. Criar coleção ml_categories para guardar a árvore de categorias do Mercado Livre
    let catCol = null
    try {
      catCol = app.findCollectionByNameOrId('ml_categories')
    } catch (_) {}

    if (!catCol) {
      const collection = new Collection({
        name: 'ml_categories',
        type: 'base',
        fields: [
          new TextField({
            name: 'category_id',
            required: true,
          }),
          new TextField({
            name: 'name',
            required: true,
          }),
          new TextField({
            name: 'parent_id',
            required: false,
          }),
          new TextField({
            name: 'family_id',
            required: false,
          }),
          new TextField({
            name: 'family_name',
            required: false,
          }),
          new TextField({
            name: 'subfamily_id',
            required: false,
          }),
          new TextField({
            name: 'subfamily_name',
            required: false,
          }),
          new TextField({
            name: 'full_path',
            required: false,
          }),
          new NumberField({
            name: 'level',
            required: false,
          }),
          new NumberField({
            name: 'total_items_in_this_category',
            required: false,
          }),
          new BoolField({
            name: 'is_leaf',
            required: false,
          }),
          new JSONField({
            name: 'path_from_root',
            required: false,
          }),
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_ml_categories_cat_id ON ml_categories (category_id)',
          'CREATE INDEX idx_ml_categories_parent ON ml_categories (parent_id, level)',
          'CREATE INDEX idx_ml_categories_family ON ml_categories (family_id, level)',
          'CREATE INDEX idx_ml_categories_name ON ml_categories (name)',
        ],
        // Leitura pública/autenticada para o seletor do frontend funcionar rápido
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: '@request.auth.id != "" && @request.auth.role = "admin"',
        updateRule: '@request.auth.id != "" && @request.auth.role = "admin"',
        deleteRule: '@request.auth.id != "" && @request.auth.role = "admin"',
      })

      app.save(collection)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('ml_categories')
      if (col) app.delete(col)
    } catch (_) {}
  },
)
