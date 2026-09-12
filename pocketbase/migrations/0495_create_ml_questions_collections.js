/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const AUTH_ALL = "@request.auth.id != ''"

    // 1. Coleção ml_questions_config (Configurações da Central de Perguntas ML e Auto-Resposta)
    if (!app.hasTable('ml_questions_config')) {
      const configCol = new Collection({
        name: 'ml_questions_config',
        type: 'base',
        listRule: AUTH_ALL,
        viewRule: AUTH_ALL,
        createRule: AUTH_ALL,
        updateRule: AUTH_ALL,
        deleteRule: AUTH_ALL,
        fields: [
          {
            name: 'auto_reply_enabled',
            type: 'bool',
            required: false,
          },
          {
            name: 'auto_reply_text',
            type: 'text',
            required: false,
          },
          {
            name: 'polling_interval_seconds',
            type: 'number',
            required: false,
          },
          {
            name: 'sla_warning_hours',
            type: 'number',
            required: false,
          },
          {
            name: 'sla_critical_hours',
            type: 'number',
            required: false,
          },
          {
            name: 'notes',
            type: 'text',
            required: false,
          },
        ],
      })
      app.save(configCol)

      // Adicionar campos autodate created e updated
      try {
        const colReload = app.findCollectionByNameOrId('ml_questions_config')
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
        console.log('[0495] Erro ao adicionar autodates em ml_questions_config: ' + err)
      }

      // Seed inicial da configuração padrão
      try {
        const colForSeed = app.findCollectionByNameOrId('ml_questions_config')
        const seedRecord = new Record(colForSeed)
        seedRecord.set('auto_reply_enabled', false)
        seedRecord.set(
          'auto_reply_text',
          'Já recebemos sua pergunta e estamos analisando as especificações técnicas para lhe responder com exatidão em instantes.',
        )
        seedRecord.set('polling_interval_seconds', 60)
        seedRecord.set('sla_warning_hours', 1)
        seedRecord.set('sla_critical_hours', 4)
        seedRecord.set('notes', 'Configuração padrão da Central de Perguntas ML')
        app.save(seedRecord)
      } catch (seedErr) {
        console.log('[0495] Erro ao criar seed de ml_questions_config: ' + seedErr)
      }

      console.log('[0495] Colecao ml_questions_config criada com sucesso')
    }

    // 2. Coleção ml_question_templates (Banco de respostas e templates que aprendem)
    if (!app.hasTable('ml_question_templates')) {
      const templatesCol = new Collection({
        name: 'ml_question_templates',
        type: 'base',
        listRule: AUTH_ALL,
        viewRule: AUTH_ALL,
        createRule: AUTH_ALL,
        updateRule: AUTH_ALL,
        deleteRule: AUTH_ALL,
        fields: [
          {
            name: 'title',
            type: 'text',
            required: true,
          },
          {
            name: 'category',
            type: 'text',
            required: false,
          },
          {
            name: 'keywords',
            type: 'json',
            required: false,
          },
          {
            name: 'content',
            type: 'text',
            required: true,
          },
          {
            name: 'use_stock_placeholder',
            type: 'bool',
            required: false,
          },
          {
            name: 'times_used',
            type: 'number',
            required: false,
          },
          {
            name: 'active',
            type: 'bool',
            required: false,
          },
        ],
        indexes: [
          'CREATE INDEX idx_ml_qtemplates_title ON ml_question_templates (title)',
          'CREATE INDEX idx_ml_qtemplates_cat ON ml_question_templates (category)',
        ],
      })
      app.save(templatesCol)

      try {
        const tColReload = app.findCollectionByNameOrId('ml_question_templates')
        if (tColReload) {
          if (!tColReload.fields.getByName('created')) {
            tColReload.fields.add(
              new AutodateField({
                name: 'created',
                onCreate: true,
                onUpdate: false,
              }),
            )
          }
          if (!tColReload.fields.getByName('updated')) {
            tColReload.fields.add(
              new AutodateField({
                name: 'updated',
                onCreate: true,
                onUpdate: true,
              }),
            )
          }
          app.save(tColReload)
        }
      } catch (err) {
        console.log('[0495] Erro ao adicionar autodates em ml_question_templates: ' + err)
      }

      // Seed inicial de templates padrão úteis
      try {
        const tColForSeed = app.findCollectionByNameOrId('ml_question_templates')
        const defaultTemplates = [
          {
            title: 'Disponibilidade de Estoque',
            category: 'estoque',
            keywords: [
              'disponivel',
              'disponível',
              'tem',
              'pronta entrega',
              'estoque',
              'unidade',
              'unidades',
              'tem ainda',
            ],
            content:
              'Olá! Sim, temos o equipamento pronto para envio imediato! Temos {estoque_real} unidades disponíveis revisadas com garantia e envio rápido. Aguardamos sua compra!',
            use_stock_placeholder: true,
            times_used: 0,
            active: true,
          },
          {
            title: 'Retirada em Mãos',
            category: 'logistica',
            keywords: ['retirar', 'retirada', 'em maos', 'em mãos', 'pegar', 'buscar', 'local'],
            content:
              'Olá! Trabalhamos com envios pelo Mercado Envios com seguro e entrega rápida em todo o Brasil. Você recebe no conforto do seu endereço!',
            use_stock_placeholder: false,
            times_used: 0,
            active: true,
          },
          {
            title: 'Nota Fiscal e Garantia',
            category: 'fiscal',
            keywords: ['nota fiscal', 'nf', 'nfe', 'nota', 'garantia', 'garantido', 'original'],
            content:
              'Olá! Sim, emitimos Nota Fiscal (NF-e) em seu nome ou empresa para todos os pedidos e oferecemos garantia de 90 dias com suporte especializado Ambicorp!',
            use_stock_placeholder: false,
            times_used: 0,
            active: true,
          },
          {
            title: 'Estado de Conservação / Bateria',
            category: 'tecnico',
            keywords: [
              'bateria',
              'saude',
              'saúde',
              'marcas',
              'riscos',
              'conservacao',
              'conservação',
              'carregador',
            ],
            content:
              'Olá! Nossos equipamentos passam por rigorosa revisão técnica e testes de estresse (bateria, tela, teclado, conexões). Acompanha carregador compatível e bateria em ótimo funcionamento.',
            use_stock_placeholder: false,
            times_used: 0,
            active: true,
          },
          {
            title: 'Upgrades de Memória / SSD',
            category: 'tecnico',
            keywords: ['upgrade', 'aumentar', 'ram', 'memoria', 'memória', 'ssd', 'expandir'],
            content:
              'Olá! Podemos verificar a possibilidade de personalização do lote de memória ou SSD antes do envio. Nos informe a configuração desejada para confirmarmos a viabilidade!',
            use_stock_placeholder: false,
            times_used: 0,
            active: true,
          },
        ]

        for (let i = 0; i < defaultTemplates.length; i++) {
          const tData = defaultTemplates[i]
          const tRec = new Record(tColForSeed)
          tRec.set('title', tData.title)
          tRec.set('category', tData.category)
          tRec.set('keywords', tData.keywords)
          tRec.set('content', tData.content)
          tRec.set('use_stock_placeholder', tData.use_stock_placeholder)
          tRec.set('times_used', tData.times_used)
          tRec.set('active', tData.active)
          app.save(tRec)
        }
      } catch (seedTErr) {
        console.log('[0495] Erro ao criar templates iniciais: ' + seedTErr)
      }

      console.log('[0495] Colecao ml_question_templates criada com sucesso')
    }

    // 3. Coleção ml_questions_cache (Armazenamento, rastreio de estados e auto-resposta)
    if (!app.hasTable('ml_questions_cache')) {
      const cacheCol = new Collection({
        name: 'ml_questions_cache',
        type: 'base',
        listRule: AUTH_ALL,
        viewRule: AUTH_ALL,
        createRule: AUTH_ALL,
        updateRule: AUTH_ALL,
        deleteRule: AUTH_ALL,
        fields: [
          {
            name: 'question_id',
            type: 'text',
            required: true,
          },
          {
            name: 'item_id',
            type: 'text',
            required: false,
          },
          {
            name: 'item_title',
            type: 'text',
            required: false,
          },
          {
            name: 'item_permalink',
            type: 'text',
            required: false,
          },
          {
            name: 'item_thumbnail',
            type: 'text',
            required: false,
          },
          {
            name: 'item_price',
            type: 'number',
            required: false,
          },
          {
            name: 'buyer_id',
            type: 'text',
            required: false,
          },
          {
            name: 'buyer_nickname',
            type: 'text',
            required: false,
          },
          {
            name: 'text',
            type: 'text',
            required: true,
          },
          {
            name: 'date_created',
            type: 'date',
            required: false,
          },
          {
            name: 'status_ml',
            type: 'text',
            required: false,
          },
          // Estados operacionais no sistema AmbicorpFlow:
          // 'unanswered' (sem resposta nenhuma)
          // 'auto_replied' (resposta inicial automática enviada pelo motor; aguardando resposta real humana)
          // 'answered' (resposta definitiva real enviada pelo usuário)
          {
            name: 'queue_status',
            type: 'select',
            required: true,
            values: ['unanswered', 'auto_replied', 'answered'],
            maxSelect: 1,
          },
          {
            name: 'initial_auto_reply_sent',
            type: 'bool',
            required: false,
          },
          {
            name: 'initial_auto_reply_text',
            type: 'text',
            required: false,
          },
          {
            name: 'initial_auto_reply_sent_at',
            type: 'date',
            required: false,
          },
          {
            name: 'real_reply_sent',
            type: 'bool',
            required: false,
          },
          {
            name: 'real_reply_text',
            type: 'text',
            required: false,
          },
          {
            name: 'real_reply_sent_at',
            type: 'date',
            required: false,
          },
          {
            name: 'real_reply_user_name',
            type: 'text',
            required: false,
          },
          {
            name: 'sla_minutes_to_real_reply',
            type: 'number',
            required: false,
          },
          {
            name: 'raw_data',
            type: 'json',
            required: false,
          },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_ml_questions_qid ON ml_questions_cache (question_id)',
          'CREATE INDEX idx_ml_questions_item ON ml_questions_cache (item_id)',
          'CREATE INDEX idx_ml_questions_queue ON ml_questions_cache (queue_status)',
          'CREATE INDEX idx_ml_questions_date ON ml_questions_cache (date_created)',
          'CREATE INDEX idx_ml_questions_buyer ON ml_questions_cache (buyer_id)',
        ],
      })
      app.save(cacheCol)

      try {
        const cColReload = app.findCollectionByNameOrId('ml_questions_cache')
        if (cColReload) {
          if (!cColReload.fields.getByName('created')) {
            cColReload.fields.add(
              new AutodateField({
                name: 'created',
                onCreate: true,
                onUpdate: false,
              }),
            )
          }
          if (!cColReload.fields.getByName('updated')) {
            cColReload.fields.add(
              new AutodateField({
                name: 'updated',
                onCreate: true,
                onUpdate: true,
              }),
            )
          }
          app.save(cColReload)
        }
      } catch (err) {
        console.log('[0495] Erro ao adicionar autodates em ml_questions_cache: ' + err)
      }

      console.log('[0495] Colecao ml_questions_cache criada com sucesso')
    }
  },
  (app) => {
    try {
      const c = app.findCollectionByNameOrId('ml_questions_cache')
      if (c) app.delete(c)
    } catch (_) {}
    try {
      const t = app.findCollectionByNameOrId('ml_question_templates')
      if (t) app.delete(t)
    } catch (_) {}
    try {
      const cfg = app.findCollectionByNameOrId('ml_questions_config')
      if (cfg) app.delete(cfg)
    } catch (_) {}
  },
)
