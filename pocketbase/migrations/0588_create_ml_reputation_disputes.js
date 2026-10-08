/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const AUTH_ALL = "@request.auth.id != ''"

    if (!app.hasTable('ml_reputation_disputes')) {
      const disputesCol = new Collection({
        name: 'ml_reputation_disputes',
        type: 'base',
        listRule: AUTH_ALL,
        viewRule: AUTH_ALL,
        createRule: AUTH_ALL,
        updateRule: AUTH_ALL,
        deleteRule: AUTH_ALL,
        fields: [
          {
            name: 'sale_id_ml',
            type: 'text',
            required: true,
          },
          {
            name: 'sale_date',
            type: 'text',
            required: false,
          },
          {
            name: 'product_title',
            type: 'text',
            required: false,
          },
          {
            name: 'problems_count',
            type: 'number',
            required: false,
          },
          {
            name: 'reputation_impact',
            type: 'text',
            required: false,
          },
          {
            name: 'exclusion_status',
            type: 'select',
            required: false,
            values: ['Nao solicitada', 'Solicitada', 'Recusada', 'Mediacao', 'Nao se aplica'],
            maxSelect: 1,
          },
          {
            name: 'exclusion_detail',
            type: 'text',
            required: false,
          },
          {
            name: 'claim_id',
            type: 'text',
            required: false,
          },
          {
            name: 'customer_name',
            type: 'text',
            required: false,
          },
          {
            name: 'customer_nickname',
            type: 'text',
            required: false,
          },
          {
            name: 'customer_phone',
            type: 'text',
            required: false,
          },
          {
            name: 'claim_reason',
            type: 'text',
            required: false,
          },
          {
            name: 'defense_text',
            type: 'text',
            required: false,
          },
          {
            name: 'dispute_status',
            type: 'select',
            required: true,
            values: [
              'Para redigir',
              'Pronto para contato',
              'Contato feito',
              'Enviado ao ML',
              'Resolvido',
              'Recusado',
            ],
            maxSelect: 1,
          },
          {
            name: 'contact_history',
            type: 'text',
            required: false,
          },
          {
            name: 'ml_order_ref',
            type: 'text',
            required: false,
          },
          {
            name: 'tenant_id',
            type: 'text',
            required: false,
          },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_ml_rep_disputes_sale ON ml_reputation_disputes (sale_id_ml)',
          'CREATE INDEX idx_ml_rep_disputes_status ON ml_reputation_disputes (dispute_status)',
        ],
      })

      app.save(disputesCol)

      // Adicionar campos autodate created e updated
      try {
        const colReload = app.findCollectionByNameOrId('ml_reputation_disputes')
        if (colReload) {
          if (!colReload.fields.getByName('created')) {
            colReload.fields.add(
              new AutodateField({
                name: 'created',
                onCreate: true,
                onUpdate: false,
              }),
            )
          }
          if (!colReload.fields.getByName('updated')) {
            colReload.fields.add(
              new AutodateField({
                name: 'updated',
                onCreate: true,
                onUpdate: true,
              }),
            )
          }
          app.save(colReload)
        }
      } catch (err) {
        console.log('[0588] Erro ao adicionar autodates em ml_reputation_disputes: ' + err)
      }

      // Seed inicial dos 6 registros reais da imagem enviada pelo usuário
      try {
        const colForSeed = app.findCollectionByNameOrId('ml_reputation_disputes')
        const seedItems = [
          {
            sale_id_ml: '20000153601400037',
            sale_date: '5 de outubro de 2026',
            product_title: 'Memória Ram Verde 4gb 1...',
            problems_count: 1,
            reputation_impact: 'Afetada',
            exclusion_status: 'Nao se aplica',
            exclusion_detail: 'Tem uma mediação com o Mercado Livre (Ir para mediação)',
            claim_id: '',
            customer_name: '',
            customer_nickname: '',
            customer_phone: '',
            claim_reason: 'com o produto entregue',
            defense_text: '',
            dispute_status: 'Para redigir',
            contact_history: '',
            tenant_id: 'ambicorpmestre1',
          },
          {
            sale_id_ml: '2000018659048666',
            sale_date: '26 de setembro de 2026',
            product_title: 'Dell Latitude 5420 i5 11a 16gb...',
            problems_count: 1,
            reputation_impact: 'Afetada',
            exclusion_status: 'Nao solicitada',
            exclusion_detail: 'Você pode pedir para analisarmos o caso (Solicitar revisão)',
            claim_id: '',
            customer_name: '',
            customer_nickname: '',
            customer_phone: '',
            claim_reason: 'com o produto entregue',
            defense_text: '',
            dispute_status: 'Para redigir',
            contact_history: '',
            tenant_id: 'ambicorpmestre1',
          },
          {
            sale_id_ml: '2000018615636316',
            sale_date: '23 de setembro de 2026',
            product_title: 'Processador Intel Core i3-7100...',
            problems_count: 1,
            reputation_impact: 'Afetada',
            exclusion_status: 'Nao solicitada',
            exclusion_detail: 'Você pode pedir para analisarmos o caso (Solicitar revisão)',
            claim_id: '',
            customer_name: '',
            customer_nickname: '',
            customer_phone: '',
            claim_reason: 'com o produto entregue',
            defense_text: '',
            dispute_status: 'Para redigir',
            contact_history: '',
            tenant_id: 'ambicorpmestre1',
          },
          {
            sale_id_ml: '2000018492175244',
            sale_date: '16 de setembro de 2026',
            product_title: 'Notebook Lenovo Thinkpad E1...',
            problems_count: 1,
            reputation_impact: 'Afetada',
            exclusion_status: 'Nao solicitada',
            exclusion_detail: 'Você pode pedir para analisarmos o caso (Solicitar revisão)',
            claim_id: '',
            customer_name: '',
            customer_nickname: '',
            customer_phone: '',
            claim_reason: 'com o produto entregue',
            defense_text: '',
            dispute_status: 'Para redigir',
            contact_history: '',
            tenant_id: 'ambicorpmestre1',
          },
          {
            sale_id_ml: '2000014847794803',
            sale_date: '3 de setembro de 2026',
            product_title: 'Moldura Da Tela Notebook...',
            problems_count: 1,
            reputation_impact: 'Afetada',
            exclusion_status: 'Nao solicitada',
            exclusion_detail: 'Você pode pedir para analisarmos o caso (Solicitar revisão)',
            claim_id: '',
            customer_name: '',
            customer_nickname: '',
            customer_phone: '',
            claim_reason: 'com o produto entregue',
            defense_text: '',
            dispute_status: 'Para redigir',
            contact_history: '',
            tenant_id: 'ambicorpmestre1',
          },
          {
            sale_id_ml: '2000014615966287',
            sale_date: '19 de agosto de 2026',
            product_title: 'Processador Intel Core i3-6100...',
            problems_count: 1,
            reputation_impact: 'Afetada',
            exclusion_status: 'Recusada',
            exclusion_detail: 'Consulte o motivo nos detalhes do caso (Ver detalhe)',
            claim_id: '',
            customer_name: '',
            customer_nickname: '',
            customer_phone: '',
            claim_reason: 'com o produto entregue',
            defense_text: '',
            dispute_status: 'Para redigir',
            contact_history: '',
            tenant_id: 'ambicorpmestre1',
          },
        ]

        for (let i = 0; i < seedItems.length; i++) {
          const item = seedItems[i]
          const rec = new Record(colForSeed)

          // Tentar enriquecer cliente se existir pedido sincronizado com esse order_id
          try {
            const foundOrder = app.findFirstRecordByFilter(
              'ml_orders',
              "order_id = '" + item.sale_id_ml + "'",
            )
            if (foundOrder) {
              rec.set('ml_order_ref', foundOrder.id)
              const bName = foundOrder.getString('buyer_name')
              const bNick = foundOrder.getString('buyer_nickname')
              if (bName) rec.set('customer_name', bName)
              if (bNick) rec.set('customer_nickname', bNick)
            }
          } catch (_) {}

          rec.set('sale_id_ml', item.sale_id_ml)
          rec.set('sale_date', item.sale_date)
          rec.set('product_title', item.product_title)
          rec.set('problems_count', item.problems_count)
          rec.set('reputation_impact', item.reputation_impact)
          rec.set('exclusion_status', item.exclusion_status)
          rec.set('exclusion_detail', item.exclusion_detail)
          rec.set('claim_id', item.claim_id)
          if (!rec.getString('customer_name')) {
            rec.set('customer_name', item.customer_name)
          }
          if (!rec.getString('customer_nickname')) {
            rec.set('customer_nickname', item.customer_nickname)
          }
          rec.set('customer_phone', item.customer_phone)
          rec.set('claim_reason', item.claim_reason)
          rec.set('defense_text', item.defense_text)
          rec.set('dispute_status', item.dispute_status)
          rec.set('contact_history', item.contact_history)
          rec.set('tenant_id', item.tenant_id)

          app.save(rec)
        }
        console.log('[0588] Seed dos 6 casos de reputação inserido com sucesso')
      } catch (seedErr) {
        console.log('[0588] Erro no seed de ml_reputation_disputes: ' + seedErr)
      }
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('ml_reputation_disputes')
      if (col) app.delete(col)
    } catch (_) {}
  },
)
