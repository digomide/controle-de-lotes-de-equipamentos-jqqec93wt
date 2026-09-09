migrate(
  (app) => {
    // 0435: Garantir campos e permissões da coleção ml_categories
    let col = null
    try {
      col = app.findCollectionByNameOrId('ml_categories')
    } catch (_) {}

    if (col) {
      if (!col.fields.getByName('category_id')) {
        col.fields.add(new TextField({ name: 'category_id', required: true }))
      }
      if (!col.fields.getByName('name')) {
        col.fields.add(new TextField({ name: 'name', required: true }))
      }
      if (!col.fields.getByName('parent_id')) {
        col.fields.add(new TextField({ name: 'parent_id', required: false }))
      }
      if (!col.fields.getByName('family_id')) {
        col.fields.add(new TextField({ name: 'family_id', required: false }))
      }
      if (!col.fields.getByName('family_name')) {
        col.fields.add(new TextField({ name: 'family_name', required: false }))
      }
      if (!col.fields.getByName('subfamily_id')) {
        col.fields.add(new TextField({ name: 'subfamily_id', required: false }))
      }
      if (!col.fields.getByName('subfamily_name')) {
        col.fields.add(new TextField({ name: 'subfamily_name', required: false }))
      }
      if (!col.fields.getByName('full_path')) {
        col.fields.add(new TextField({ name: 'full_path', required: false }))
      }
      if (!col.fields.getByName('level')) {
        col.fields.add(new NumberField({ name: 'level', required: false }))
      }
      if (!col.fields.getByName('total_items_in_this_category')) {
        col.fields.add(new NumberField({ name: 'total_items_in_this_category', required: false }))
      }
      if (!col.fields.getByName('is_leaf')) {
        col.fields.add(new BoolField({ name: 'is_leaf', required: false }))
      }
      if (!col.fields.getByName('path_from_root')) {
        col.fields.add(new JSONField({ name: 'path_from_root', required: false }))
      }

      // Regras de acesso autenticadas
      col.listRule = '@request.auth.id != ""'
      col.viewRule = '@request.auth.id != ""'
      col.createRule = '@request.auth.id != ""'
      col.updateRule = '@request.auth.id != ""'
      col.deleteRule = '@request.auth.id != "" && @request.auth.role = "admin"'

      app.save(col)
    }

    // Garantir campos em ml_catalog_search_jobs
    const searchJobs = app.findCollectionByNameOrId('ml_catalog_search_jobs')
    if (searchJobs) {
      if (!searchJobs.fields.getByName('category_id')) {
        searchJobs.fields.add(new TextField({ name: 'category_id', required: false }))
      }
      if (!searchJobs.fields.getByName('category_path')) {
        searchJobs.fields.add(new TextField({ name: 'category_path', required: false }))
      }
      if (!searchJobs.fields.getByName('progress_count')) {
        searchJobs.fields.add(new NumberField({ name: 'progress_count', required: false }))
      }
      app.save(searchJobs)
    }
  },
  () => {},
)
