migrate(
  (app) => {
    // 1. Criar coleção ml_settings para guardar com segurança as credenciais e tokens do Mercado Livre
    if (!app.hasTable('ml_settings')) {
      const mlSettings = new Collection({
        name: 'ml_settings',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          { name: 'client_id', type: 'text' },
          { name: 'client_secret', type: 'text' },
          { name: 'redirect_uri', type: 'text' },
          { name: 'access_token', type: 'text' },
          { name: 'refresh_token', type: 'text' },
          { name: 'token_expires_at', type: 'date' },
          { name: 'user_id_ml', type: 'text' },
          { name: 'nickname', type: 'text' },
          { name: 'permalink_seller', type: 'text' },
          { name: 'site_id', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
      })
      app.save(mlSettings)
    }

    // 2. Adicionar campos de publicação do Mercado Livre na coleção products
    const products = app.findCollectionByNameOrId('products')

    if (!products.fields.getByName('ml_listing_id')) {
      products.fields.add(
        new TextField({
          name: 'ml_listing_id',
        }),
      )
    }

    if (!products.fields.getByName('ml_listing_url')) {
      products.fields.add(
        new TextField({
          name: 'ml_listing_url',
        }),
      )
    }

    if (!products.fields.getByName('ml_listing_status')) {
      products.fields.add(
        new TextField({
          name: 'ml_listing_status',
        }),
      )
    }

    if (!products.fields.getByName('ml_published_at')) {
      products.fields.add(
        new DateField({
          name: 'ml_published_at',
        }),
      )
    }

    app.save(products)
  },
  (app) => {
    try {
      const mlSettings = app.findCollectionByNameOrId('ml_settings')
      if (mlSettings) {
        app.delete(mlSettings)
      }
    } catch (_) {}

    try {
      const products = app.findCollectionByNameOrId('products')
      const f1 = products.fields.getByName('ml_listing_id')
      if (f1) products.fields.remove(f1)
      const f2 = products.fields.getByName('ml_listing_url')
      if (f2) products.fields.remove(f2)
      const f3 = products.fields.getByName('ml_listing_status')
      if (f3) products.fields.remove(f3)
      const f4 = products.fields.getByName('ml_published_at')
      if (f4) products.fields.remove(f4)
      app.save(products)
    } catch (_) {}
  },
)
