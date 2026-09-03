migrate(
  (app) => {
    const products = app.findCollectionByNameOrId('products')

    if (!products.fields.getByName('photos')) {
      products.fields.add(
        new FileField({
          name: 'photos',
          maxSelect: 15,
          maxSize: 10485760, // 10MB
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        }),
      )
      app.save(products)
    }
  },
  (app) => {
    try {
      const products = app.findCollectionByNameOrId('products')
      const field = products.fields.getByName('photos')
      if (field) {
        products.fields.remove(field)
        app.save(products)
      }
    } catch (_) {}
  },
)
