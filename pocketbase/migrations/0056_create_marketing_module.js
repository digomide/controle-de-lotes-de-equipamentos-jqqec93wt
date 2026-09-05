migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const productsCol = app.findCollectionByNameOrId('products')

    // 1. marketing_settings
    const marketingSettings = new Collection({
      name: 'marketing_settings',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'meta_wa_token', type: 'text' },
        { name: 'meta_wa_phone_number_id', type: 'text' },
        { name: 'meta_wa_business_account_id', type: 'text' },
        { name: 'instagram_user_id', type: 'text' },
        { name: 'instagram_token', type: 'text' },
        { name: 'sender_phone_display', type: 'text' },
        { name: 'notes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(marketingSettings)

    // 2. marketing_contacts
    const marketingContacts = new Collection({
      name: 'marketing_contacts',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'phone', type: 'text', required: true },
        {
          name: 'tipo',
          type: 'select',
          required: true,
          values: ['revendedor', 'cliente', 'corporativo'],
          maxSelect: 1,
        },
        { name: 'tags', type: 'json' },
        {
          name: 'source',
          type: 'select',
          required: true,
          values: ['manual', 'import', 'compra', 'cotacao'],
          maxSelect: 1,
        },
        { name: 'opt_in', type: 'bool' }, // Never required on bool in PB
        { name: 'last_sent_at', type: 'date' },
        { name: 'notes', type: 'text' },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['ativo', 'inativo'],
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_marketing_contacts_phone ON marketing_contacts (phone)',
        'CREATE INDEX idx_marketing_contacts_tipo ON marketing_contacts (tipo)',
        'CREATE INDEX idx_marketing_contacts_status ON marketing_contacts (status)',
        'CREATE INDEX idx_marketing_contacts_created ON marketing_contacts (created DESC)',
      ],
    })
    app.save(marketingContacts)

    // 3. marketing_campaigns
    const marketingCampaigns = new Collection({
      name: 'marketing_campaigns',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'name', type: 'text', required: true },
        {
          name: 'channel',
          type: 'select',
          required: true,
          values: ['whatsapp', 'instagram', 'ambos'],
          maxSelect: 1,
        },
        { name: 'template_key', type: 'text' },
        {
          name: 'product_id',
          type: 'relation',
          collectionId: productsCol.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'batch_notice', type: 'bool' },
        { name: 'message_body', type: 'text' },
        { name: 'audience_filter', type: 'json' },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['rascunho', 'agendada', 'enviando', 'pausada', 'concluida', 'erro'],
          maxSelect: 1,
        },
        { name: 'scheduled_at', type: 'date' },
        { name: 'stats', type: 'json' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_marketing_campaigns_status ON marketing_campaigns (status)',
        'CREATE INDEX idx_marketing_campaigns_scheduled ON marketing_campaigns (scheduled_at)',
        'CREATE INDEX idx_marketing_campaigns_created ON marketing_campaigns (created DESC)',
      ],
    })
    app.save(marketingCampaigns)

    // 4. marketing_messages
    const campaignsCol = app.findCollectionByNameOrId('marketing_campaigns')
    const contactsCol = app.findCollectionByNameOrId('marketing_contacts')

    const marketingMessages = new Collection({
      name: 'marketing_messages',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'campaign_id',
          type: 'relation',
          collectionId: campaignsCol.id,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'contact_id',
          type: 'relation',
          collectionId: contactsCol.id,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'phone', type: 'text', required: true },
        { name: 'body_final', type: 'text' },
        { name: 'wa_message_id', type: 'text' },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['pendente', 'enviado', 'entregue', 'lido', 'falhou', 'sem_credencial'],
          maxSelect: 1,
        },
        { name: 'error', type: 'text' },
        { name: 'sent_at', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_marketing_messages_camp ON marketing_messages (campaign_id)',
        'CREATE INDEX idx_marketing_messages_contact ON marketing_messages (contact_id)',
        'CREATE INDEX idx_marketing_messages_status ON marketing_messages (status)',
        'CREATE INDEX idx_marketing_messages_created ON marketing_messages (created DESC)',
      ],
    })
    app.save(marketingMessages)
  },
  (app) => {
    try {
      const mm = app.findCollectionByNameOrId('marketing_messages')
      app.delete(mm)
    } catch (_) {}
    try {
      const mc = app.findCollectionByNameOrId('marketing_campaigns')
      app.delete(mc)
    } catch (_) {}
    try {
      const mct = app.findCollectionByNameOrId('marketing_contacts')
      app.delete(mct)
    } catch (_) {}
    try {
      const ms = app.findCollectionByNameOrId('marketing_settings')
      app.delete(ms)
    } catch (_) {}
  },
)
