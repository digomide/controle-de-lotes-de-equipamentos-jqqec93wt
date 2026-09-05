migrate(
  (app) => {
    // 1. Coleção social_posts para fila de publicações do Instagram
    const productsCol = app.findCollectionByNameOrId('products')

    const socialPosts = new Collection({
      name: 'social_posts',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'product_id',
          type: 'relation',
          required: true,
          collectionId: productsCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['Pendente', 'Postado'],
          maxSelect: 1,
        },
        {
          name: 'format',
          type: 'select',
          required: false,
          values: ['tecnico', 'urgencia', 'lote'],
          maxSelect: 1,
        },
        {
          name: 'caption',
          type: 'text',
          required: false,
        },
        {
          name: 'posted_at',
          type: 'date',
          required: false,
        },
        {
          name: 'notes',
          type: 'text',
          required: false,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_social_posts_status ON social_posts (status)',
        'CREATE INDEX idx_social_posts_product ON social_posts (product_id)',
      ],
    })
    app.save(socialPosts)

    // 2. Coleção corporate_leads para cotações corporativas
    const corporateLeads = new Collection({
      name: 'corporate_leads',
      type: 'base',
      // Criação pública (qualquer visitante da loja pode enviar cotação)
      // Leitura, atualização e exclusão apenas autenticado
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: '',
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'company',
          type: 'text',
          required: true,
        },
        {
          name: 'contact_name',
          type: 'text',
          required: true,
        },
        {
          name: 'email',
          type: 'email',
          required: true,
        },
        {
          name: 'phone',
          type: 'text',
          required: true,
        },
        {
          name: 'profile',
          type: 'select',
          required: true,
          values: ['Revendedor', 'Empresa — uso interno'],
          maxSelect: 1,
        },
        {
          name: 'interest',
          type: 'text',
          required: false,
        },
        {
          name: 'quantity',
          type: 'text',
          required: false,
        },
        {
          name: 'message',
          type: 'text',
          required: false,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['novo', 'atendido'],
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_corporate_leads_status ON corporate_leads (status)',
        'CREATE INDEX idx_corporate_leads_created ON corporate_leads (created DESC)',
      ],
    })
    app.save(corporateLeads)
  },
  (app) => {
    try {
      const sp = app.findCollectionByNameOrId('social_posts')
      app.delete(sp)
    } catch (_) {}

    try {
      const cl = app.findCollectionByNameOrId('corporate_leads')
      app.delete(cl)
    } catch (_) {}
  },
)
