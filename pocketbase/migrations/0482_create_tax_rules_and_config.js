/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const AUTH_ALL = "@request.auth.id != ''"

    // 1. Criar coleção tax_rules (Padrões Fiscais por Categoria de Produto)
    if (!app.hasTable('tax_rules')) {
      const taxRules = new Collection({
        name: 'tax_rules',
        type: 'base',
        listRule: AUTH_ALL,
        viewRule: AUTH_ALL,
        createRule: AUTH_ALL,
        updateRule: AUTH_ALL,
        deleteRule: AUTH_ALL,
        fields: [
          {
            name: 'categoria',
            type: 'text',
            required: true,
          },
          {
            name: 'cfop_dentro',
            type: 'text',
            required: true,
          },
          {
            name: 'cfop_fora',
            type: 'text',
            required: true,
          },
          {
            name: 'csosn',
            type: 'text',
            required: false,
          },
          {
            name: 'cst',
            type: 'text',
            required: false,
          },
          {
            name: 'origem',
            type: 'number',
            required: false,
          },
          {
            name: 'ncm_sugerido',
            type: 'text',
            required: false,
          },
          {
            name: 'cest_sugerido',
            type: 'text',
            required: false,
          },
          {
            name: 'ativo',
            type: 'bool',
            required: false,
          },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_tax_rules_categoria ON tax_rules (categoria)',
          'CREATE INDEX idx_tax_rules_ativo ON tax_rules (ativo)',
        ],
      })
      app.save(taxRules)
      console.log('[0482] Coleção tax_rules criada')

      // Seed das 3 regras iniciais conforme especificado pelo usuário:
      // (a) Memória: NCM 84733042, CEST 21.035.00, CFOP 5405/6404, CSOSN 500, origem 0
      // (b) Notebook: NCM 84713012, sem CEST, CFOP 5405/6404, CSOSN 500, origem 0
      // (c) HD/SSD: NCM 84717090 (NÃO 84717010), sem CEST, CFOP 5405/6404, CSOSN 500, origem 0
      const initialRules = [
        {
          categoria: 'Memória',
          cfop_dentro: '5405',
          cfop_fora: '6404',
          csosn: '500',
          cst: '',
          origem: 0,
          ncm_sugerido: '84733042',
          cest_sugerido: '21.035.00',
          ativo: true,
        },
        {
          categoria: 'Notebook',
          cfop_dentro: '5405',
          cfop_fora: '6404',
          csosn: '500',
          cst: '',
          origem: 0,
          ncm_sugerido: '84713012',
          cest_sugerido: '',
          ativo: true,
        },
        {
          categoria: 'HD/SSD',
          cfop_dentro: '5405',
          cfop_fora: '6404',
          csosn: '500',
          cst: '',
          origem: 0,
          ncm_sugerido: '84717090',
          cest_sugerido: '',
          ativo: true,
        },
      ]

      for (const rule of initialRules) {
        const record = new Record(taxRules)
        record.set('categoria', rule.categoria)
        record.set('cfop_dentro', rule.cfop_dentro)
        record.set('cfop_fora', rule.cfop_fora)
        record.set('csosn', rule.csosn)
        record.set('cst', rule.cst)
        record.set('origem', rule.origem)
        record.set('ncm_sugerido', rule.ncm_sugerido)
        record.set('cest_sugerido', rule.cest_sugerido)
        record.set('ativo', rule.ativo)
        app.save(record)
      }
      console.log('[0482] 3 regras fiscais semeadas (Memória, Notebook, HD/SSD)')
    }

    // 2. Estender ou atualizar nf_config para garantir serie_nfe='2', regime_tributario, proximo_numero_nfe e defaults
    if (app.hasTable('nf_config')) {
      const existingConfigs = app.findRecordsByFilter('nf_config', '1=1', '', 10, 0)
      for (const cfg of existingConfigs) {
        let changed = false
        if (!cfg.getString('serie_nfe') || cfg.getString('serie_nfe') === '1') {
          cfg.set('serie_nfe', '2')
          changed = true
        }
        if (!cfg.getInt('proximo_numero_nfe')) {
          cfg.set('proximo_numero_nfe', 1)
          changed = true
        }
        if (
          !cfg.getString('natureza_operacao_padrao') ||
          cfg.getString('natureza_operacao_padrao') === 'VENDA DE MERCADORIA USADA'
        ) {
          cfg.set('natureza_operacao_padrao', 'Venda de Mercadorias')
          changed = true
        }
        if (!cfg.getString('regime_tributario')) {
          cfg.set('regime_tributario', '1') // Simples Nacional
          changed = true
        }
        if (changed) {
          app.save(cfg)
          console.log(
            '[0482] nf_config id=' +
              cfg.id +
              ' atualizada para serie_nfe=2 e natureza=Venda de Mercadorias',
          )
        }
      }
    }
  },
  (app) => {
    try {
      const taxRules = app.findCollectionByNameOrId('tax_rules')
      if (taxRules) app.delete(taxRules)
    } catch (_) {}
  },
)
