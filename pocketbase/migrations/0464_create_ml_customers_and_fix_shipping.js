/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const AUTH_ALL = "@request.auth.id != ''"
    const ADMIN_ONLY = "@request.auth.id != '' && @request.auth.role = 'admin'"

    // =========================================================================
    // 1. Criar coleção ml_customers (CRM de Clientes & Pós-Venda)
    // =========================================================================
    if (!app.hasTable('ml_customers')) {
      const customersCol = new Collection({
        name: 'ml_customers',
        type: 'base',
        listRule: AUTH_ALL,
        viewRule: AUTH_ALL,
        createRule: AUTH_ALL,
        updateRule: AUTH_ALL,
        deleteRule: ADMIN_ONLY,
        fields: [
          { name: 'name', type: 'text', required: true },
          { name: 'nickname', type: 'text' }, // Apelido no ML (ex: DIEGOSOUZA89)
          { name: 'buyer_id', type: 'text' }, // ID numérico do comprador no ML
          { name: 'phone', type: 'text' },
          { name: 'email', type: 'text' },
          { name: 'document', type: 'text' }, // CPF/CNPJ
          { name: 'address', type: 'text' }, // Endereço formatado em texto
          { name: 'raw_address', type: 'json' },
          {
            name: 'origin',
            type: 'select',
            values: ['ml', 'manual', 'loja', 'outro'],
            maxSelect: 1,
            required: true,
          },
          { name: 'notes', type: 'text' }, // Observações gerais
          { name: 'notes_history', type: 'json' }, // Histórico de notas: [{ date, author, text }]
          { name: 'next_contact_date', type: 'date' }, // Data agendada para retorno / pós-venda
          { name: 'tags', type: 'json' }, // ['recorrente', 'vip', 'revendedor', etc]
        ],
        indexes: [
          'CREATE INDEX idx_ml_customers_name ON ml_customers (name)',
          'CREATE INDEX idx_ml_customers_buyer_id ON ml_customers (buyer_id)',
          'CREATE INDEX idx_ml_customers_nickname ON ml_customers (nickname)',
          'CREATE INDEX idx_ml_customers_phone ON ml_customers (phone)',
          'CREATE INDEX idx_ml_customers_origin ON ml_customers (origin)',
          'CREATE INDEX idx_ml_customers_next_contact ON ml_customers (next_contact_date)',
        ],
      })

      app.save(customersCol)
      console.log('[0464] Coleção ml_customers criada com sucesso')
    }

    // =========================================================================
    // 2. Correção retroativa dos status de envio em ml_orders:
    //    - Pedidos que têm a tag exata 'not_delivered' e estavam como 'delivered' ou 'shipped'
    //      VOLTAM para 'pending' (não entregues)
    //    - Pedidos antigos com tag exata 'delivered' PERMANECEM 'delivered'
    // =========================================================================
    let fixedNotDeliveredCount = 0
    try {
      const orders = app.findRecordsByFilter('ml_orders', '1=1', '-date_created', 1000, 0)
      for (let i = 0; i < orders.length; i++) {
        const o = orders[i]
        const rawTags = o.get('tags')
        let tagsList = []
        if (Array.isArray(rawTags)) {
          tagsList = rawTags
        } else if (typeof rawTags === 'string') {
          try {
            tagsList = JSON.parse(rawTags)
          } catch (_) {
            tagsList = [rawTags]
          }
        }

        const hasExactNotDelivered = tagsList.includes('not_delivered')
        const hasExactDelivered = tagsList.includes('delivered')
        const currentShippingStatus = o.getString('shipping_status')

        // Se tem tag exata not_delivered e não tem tag exata delivered
        if (hasExactNotDelivered && !hasExactDelivered) {
          if (currentShippingStatus === 'delivered' || currentShippingStatus === 'shipped') {
            o.set('shipping_status', 'pending')
            app.save(o)
            fixedNotDeliveredCount++
          }
        }
      }
      console.log(
        '[0464] Correção retroativa concluída: ' +
          fixedNotDeliveredCount +
          ' pedidos com not_delivered revertidos para shipping_status=pending',
      )
    } catch (errOrders) {
      console.log('[0464] Erro ao corrigir pedidos ml_orders: ' + errOrders)
    }

    // =========================================================================
    // 3. Popular clientes iniciais em ml_customers a partir dos pedidos ml_orders
    //    Agrupar por buyer_id ou buyer_nickname de forma idempotente
    // =========================================================================
    try {
      const customersCol = app.findCollectionByNameOrId('ml_customers')
      if (customersCol) {
        const allOrders = app.findRecordsByFilter('ml_orders', '1=1', 'date_created', 1000, 0)
        let customersCreated = 0

        for (let i = 0; i < allOrders.length; i++) {
          const ord = allOrders[i]
          const buyerId = ord.getString('buyer_id')
          const buyerNick = ord.getString('buyer_nickname')
          const buyerName = ord.getString('buyer_name')
          const buyerDoc = ord.getString('buyer_document')
          const recAddress = ord.get('receiver_address')

          if (!buyerId && !buyerNick) continue

          // Verificar se já existe
          let existingCust = null
          if (buyerId) {
            try {
              existingCust = app.findFirstRecordByFilter(
                'ml_customers',
                "buyer_id = '" + buyerId + "'",
              )
            } catch (_) {}
          }
          if (!existingCust && buyerNick) {
            try {
              existingCust = app.findFirstRecordByFilter(
                'ml_customers',
                "nickname = '" + buyerNick.replace(/'/g, "\\'") + "'",
              )
            } catch (_) {}
          }

          let formattedAddr = ''
          if (recAddress && typeof recAddress === 'object') {
            const parts = [
              recAddress.street_name
                ? recAddress.street_name +
                  (recAddress.street_number ? ', ' + recAddress.street_number : '')
                : '',
              recAddress.comment || recAddress.address_line || '',
              (recAddress.city && recAddress.city.name) || '',
              (recAddress.state && recAddress.state.name) || '',
              recAddress.zip_code ? 'CEP ' + recAddress.zip_code : '',
            ].filter(Boolean)
            formattedAddr = parts.join(' - ')
          }

          const target = existingCust || new Record(customersCol)
          const finalName = buyerName || buyerNick || 'Cliente ML ' + (buyerId || '')

          if (!existingCust) {
            target.set('buyer_id', buyerId)
            target.set('nickname', buyerNick)
            target.set('name', finalName)
            if (buyerDoc) target.set('document', buyerDoc)
            if (formattedAddr) target.set('address', formattedAddr)
            if (recAddress) target.set('raw_address', recAddress)
            target.set('origin', 'ml')
            target.set('tags', ['ml'])
            app.save(target)
            customersCreated++
          } else {
            // Atualizar campos vazios
            if (buyerName && !target.getString('name')) target.set('name', buyerName)
            if (buyerDoc && !target.getString('document')) target.set('document', buyerDoc)
            if (formattedAddr && !target.getString('address')) target.set('address', formattedAddr)
            if (recAddress && !target.get('raw_address')) target.set('raw_address', recAddress)
            app.save(target)
          }
        }

        console.log('[0464] Clientes iniciais importados de ml_orders: ' + customersCreated)
      }
    } catch (errCust) {
      console.log('[0464] Erro ao importar clientes iniciais: ' + errCust)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('ml_customers')
      if (col) app.delete(col)
    } catch (_) {}
  },
)
