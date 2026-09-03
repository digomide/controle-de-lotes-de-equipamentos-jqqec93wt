migrate(
  (app) => {
    const products = app.findCollectionByNameOrId('products')

    // Permitir list e view públicos para produtos disponíveis
    // Mantém create, update e delete restritos a usuários autenticados
    products.listRule = "@request.auth.id != '' || status = 'Disponível'"
    products.viewRule = "@request.auth.id != '' || status = 'Disponível'"

    app.save(products)
  },
  (app) => {
    try {
      const products = app.findCollectionByNameOrId('products')
      products.listRule = "@request.auth.id != ''"
      products.viewRule = "@request.auth.id != ''"
      app.save(products)
    } catch (_) {}
  },
)
