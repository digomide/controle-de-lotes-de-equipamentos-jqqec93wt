/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const AUTH_ALL = "@request.auth.id != ''"

    // 1. Criar ou atualizar a coleção ml_monitored_sellers
    if (!app.hasTable('ml_monitored_sellers')) {
      const col = new Collection({
        name: 'ml_monitored_sellers',
        type: 'base',
        listRule: AUTH_ALL,
        viewRule: AUTH_ALL,
        createRule: AUTH_ALL,
        updateRule: AUTH_ALL,
        deleteRule: AUTH_ALL,
        fields: [
          {
            name: 'seller_id',
            type: 'text',
            required: true,
          },
          {
            name: 'nickname',
            type: 'text',
            required: true,
          },
          {
            name: 'seller_type', // 'connected', 'demo', 'public'
            type: 'text',
            required: false,
          },
          {
            name: 'auth_status', // 'connected', 'expiring', 'unauthorized', 'demo'
            type: 'text',
            required: false,
          },
          {
            name: 'status_message',
            type: 'text',
            required: false,
          },
          {
            name: 'access_token',
            type: 'text',
            required: false,
          },
          {
            name: 'refresh_token',
            type: 'text',
            required: false,
          },
          {
            name: 'client_id',
            type: 'text',
            required: false,
          },
          {
            name: 'client_secret',
            type: 'text',
            required: false,
          },
          {
            name: 'token_expires_at',
            type: 'date',
            required: false,
          },
          {
            name: 'reputation_level', // '5_green', '4_light_green', '3_yellow', '2_orange', '1_red'
            type: 'text',
            required: false,
          },
          {
            name: 'power_seller_status', // 'platinum', 'gold', 'silver', null
            type: 'text',
            required: false,
          },
          {
            name: 'active_ads_count',
            type: 'number',
            required: false,
          },
          {
            name: 'paused_ads_count',
            type: 'number',
            required: false,
          },
          {
            name: 'closed_ads_count',
            type: 'number',
            required: false,
          },
          {
            name: 'total_ads_count',
            type: 'number',
            required: false,
          },
          {
            name: 'sales_7d_count',
            type: 'number',
            required: false,
          },
          {
            name: 'sales_30d_count',
            type: 'number',
            required: false,
          },
          {
            name: 'sales_30d_amount',
            type: 'number',
            required: false,
          },
          {
            name: 'pending_questions_count',
            type: 'number',
            required: false,
          },
          {
            name: 'avg_response_time_minutes',
            type: 'number',
            required: false,
          },
          {
            name: 'paused_spike_alert',
            type: 'bool',
            required: false,
          },
          {
            name: 'reputation_drop_alert',
            type: 'bool',
            required: false,
          },
          {
            name: 'metrics_snapshot',
            type: 'json',
            required: false,
          },
          {
            name: 'last_synced_at',
            type: 'date',
            required: false,
          },
          {
            name: 'notes',
            type: 'text',
            required: false,
          },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_ml_monitored_sellers_seller_id ON ml_monitored_sellers (seller_id)',
          'CREATE INDEX idx_ml_monitored_sellers_nickname ON ml_monitored_sellers (nickname)',
        ],
      })

      app.save(col)
      console.log('[migration 0498] Coleção ml_monitored_sellers criada com sucesso.')
    }

    // 2. Garantir campos created e updated na coleção
    try {
      const colReload = app.findCollectionByNameOrId('ml_monitored_sellers')
      if (colReload) {
        let changed = false
        if (!colReload.fields.getByName('created')) {
          colReload.fields.add(
            new AutodateField({
              name: 'created',
              onCreate: true,
              onUpdate: false,
            }),
          )
          changed = true
        }
        if (!colReload.fields.getByName('updated')) {
          colReload.fields.add(
            new AutodateField({
              name: 'updated',
              onCreate: true,
              onUpdate: true,
            }),
          )
          changed = true
        }
        if (changed) {
          app.save(colReload)
        }
      }
    } catch (err) {
      console.log('[migration 0498] Aviso ao adicionar autodates: ' + err)
    }

    // 3. Semear sellers essenciais:
    // - INFOPRECOBAIXO (Principal)
    // - TAY TECH (com diagnóstico 401 documentado e amigável)
    // - LOTE TECH BRASIL (Demo com alerta de reputação)
    try {
      const colForSeed = app.findCollectionByNameOrId('ml_monitored_sellers')

      // 3.1 INFOPRECOBAIXO
      const existingOwn = app.findRecordsByFilter(
        'ml_monitored_sellers',
        "seller_id = '626774396' || nickname = 'INFOPRECOBAIXO'",
        '-created',
        1,
        0,
      )

      if (!existingOwn || existingOwn.length === 0) {
        let ownSettings = null
        try {
          const s = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
          if (s && s.length > 0) ownSettings = s[0]
        } catch (_) {}

        const ownRec = new Record(colForSeed)
        ownRec.set(
          'seller_id',
          ownSettings ? ownSettings.getString('user_id_ml') || '626774396' : '626774396',
        )
        ownRec.set(
          'nickname',
          ownSettings ? ownSettings.getString('nickname') || 'INFOPRECOBAIXO' : 'INFOPRECOBAIXO',
        )
        ownRec.set('seller_type', 'connected')
        ownRec.set('auth_status', 'connected')
        ownRec.set('status_message', 'Monitoramento ativo e sincronizado com o Mercado Livre.')
        ownRec.set('reputation_level', '5_green')
        ownRec.set('power_seller_status', 'platinum')
        ownRec.set('active_ads_count', 76)
        ownRec.set('paused_ads_count', 490)
        ownRec.set('closed_ads_count', 8)
        ownRec.set('total_ads_count', 574)
        ownRec.set('sales_7d_count', 32)
        ownRec.set('sales_30d_count', 145)
        ownRec.set('sales_30d_amount', 328000.0)
        ownRec.set('pending_questions_count', 0)
        ownRec.set('avg_response_time_minutes', 12)
        ownRec.set('paused_spike_alert', false)
        ownRec.set('reputation_drop_alert', false)
        ownRec.set('notes', 'Conta Principal Oficial Ambicorp / INFOPRECOBAIXO.')
        ownRec.set('last_synced_at', new Date().toISOString())
        ownRec.set('metrics_snapshot', {
          last_error_code: null,
          historical_active_ads: [70, 72, 74, 75, 76],
        })
        app.save(ownRec)
        console.log('[migration 0498] Seller INFOPRECOBAIXO inserido.')
      }

      // 3.2 TAY TECH (com diagnóstico amigável do 401 e alerta de anúncios pausados)
      const existingTay = app.findRecordsByFilter(
        'ml_monitored_sellers',
        "seller_id = 'TAY_TECH_109' || nickname ~ 'TAY'",
        '-created',
        1,
        0,
      )

      if (!existingTay || existingTay.length === 0) {
        const tayRec = new Record(colForSeed)
        tayRec.set('seller_id', 'TAY_TECH_109')
        tayRec.set('nickname', 'TAY TECH')
        tayRec.set('seller_type', 'connected')
        tayRec.set('auth_status', 'unauthorized')
        tayRec.set(
          'status_message',
          'Sessão expirada no Mercado Livre (HTTP 401). O token de acesso do parceiro expirou ou foi desconectado. Clique em "Reautenticar" para restabelecer a sincronização.',
        )
        tayRec.set('reputation_level', '5_green')
        tayRec.set('power_seller_status', 'gold')
        tayRec.set('active_ads_count', 42)
        tayRec.set('paused_ads_count', 18)
        tayRec.set('closed_ads_count', 120)
        tayRec.set('total_ads_count', 180)
        tayRec.set('sales_7d_count', 14)
        tayRec.set('sales_30d_count', 68)
        tayRec.set('sales_30d_amount', 142500.0)
        tayRec.set('pending_questions_count', 4)
        tayRec.set('avg_response_time_minutes', 19)
        tayRec.set('paused_spike_alert', true) // Alerta de pausa de múltiplos anúncios
        tayRec.set('reputation_drop_alert', false)
        tayRec.set(
          'notes',
          'Revendedor parceiro de lotes de notebooks corporativos (Dell e Lenovo).',
        )
        tayRec.set('last_synced_at', new Date().toISOString())
        tayRec.set('metrics_snapshot', {
          last_error_code: 401,
          last_error_detail: 'invalid_token: The caller is not authorized or token expired',
          recent_spikes: 'Atenção: 10 anúncios foram pausados nos últimos 3 dias.',
          token_expires_at: '2026-09-01T00:00:00.000Z',
        })
        app.save(tayRec)
        console.log('[migration 0498] Seller TAY TECH inserido com diagnóstico 401.')
      }

      // 3.3 LOTE TECH BRASIL (Demo com Alerta de Queda de Reputação)
      const existingDemo = app.findRecordsByFilter(
        'ml_monitored_sellers',
        "seller_id = 'DEMO_LOTE_SP_99'",
        '-created',
        1,
        0,
      )

      if (!existingDemo || existingDemo.length === 0) {
        const demoRec = new Record(colForSeed)
        demoRec.set('seller_id', 'DEMO_LOTE_SP_99')
        demoRec.set('nickname', 'LOTE TECH BRASIL (Demo)')
        demoRec.set('seller_type', 'demo')
        demoRec.set('auth_status', 'demo')
        demoRec.set(
          'status_message',
          'Vendedor parceiro de demonstração para testes de KPIs de revendedores.',
        )
        demoRec.set('reputation_level', '3_yellow')
        demoRec.set('power_seller_status', 'silver')
        demoRec.set('active_ads_count', 24)
        demoRec.set('paused_ads_count', 35)
        demoRec.set('closed_ads_count', 80)
        demoRec.set('total_ads_count', 139)
        demoRec.set('sales_7d_count', 5)
        demoRec.set('sales_30d_count', 28)
        demoRec.set('sales_30d_amount', 54200.0)
        demoRec.set('pending_questions_count', 7)
        demoRec.set('avg_response_time_minutes', 48)
        demoRec.set('paused_spike_alert', false)
        demoRec.set('reputation_drop_alert', true) // Alerta de reputação amarela
        demoRec.set(
          'notes',
          'Revendedor parceiro de Minas e SP - Lotes de notebooks intermediários.',
        )
        demoRec.set('last_synced_at', new Date().toISOString())
        demoRec.set('metrics_snapshot', {
          last_error_code: null,
          demo_mode: true,
          reputation_warning:
            'Termômetro caiu para nível amarelo (atenção a reclamações e mediações).',
        })
        app.save(demoRec)
        console.log('[migration 0498] Seller Demo LOTE TECH inserido.')
      }
    } catch (seedErr) {
      console.log('[migration 0498] Aviso ao semear dados: ' + seedErr)
    }
  },
  (app) => {
    // down migration
  },
)
