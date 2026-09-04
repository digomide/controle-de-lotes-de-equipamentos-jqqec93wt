migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('products')
    if (!col.fields.getByName('gtin')) {
      col.fields.add(
        new TextField({
          name: 'gtin',
          required: false,
        }),
      )
      app.save(col)
    }
  },
  (app) => {
    const col = app.findCollectionByNameOrId('products')
    const field = col.fields.getByName('gtin')
    if (field) {
      col.fields.removeByName('gtin')
      app.save(col)
    }
  },
)
