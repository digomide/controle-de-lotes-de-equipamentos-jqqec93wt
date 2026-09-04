migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('products')

    if (!collection.fields.getByName('photo_order')) {
      collection.fields.add(
        new JSONField({
          name: 'photo_order',
          required: false,
          maxSize: 2000000,
        }),
      )
      app.save(collection)
    }
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('products')
    const field = collection.fields.getByName('photo_order')
    if (field) {
      collection.fields.removeByName('photo_order')
      app.save(collection)
    }
  },
)
