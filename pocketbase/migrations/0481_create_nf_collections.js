/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const AUTH_ALL = "@request.auth.id != ''"

    // 1. Criar coleção nf_config (Parâmetros da Empresa Emissora & Focus NFe)
    if (!app.hasTable('nf_config')) {
      const nfConfig = new Collection({
        name: 'nf_config',
        type: 'base',
        listRule: AUTH_ALL,
        viewRule: AUTH_ALL,
        createRule: AUTH_ALL,
        updateRule: AUTH_ALL,
        deleteRule: AUTH_ALL,
        fields: [
          {
            name: 'focus_token',
            type: 'text',
            required: false,
          },
          {
            name: 'environment',
            type: 'select',
            required: true,
            values: ['homologacao', 'producao'],
            maxSelect: 1,
          },
          // Dados do Certificado A1 (.pfx)
          {
            name: 'certificate_file',
            type: 'file',
            required: false,
            maxSelect: 1,
            maxSize: 10485760, // 10MB
          },
          {
            name: 'certificate_password',
            type: 'text',
            required: false,
          },
          {
            name: 'certificate_status',
            type: 'text',
            required: false,
          },
          {
            name: 'certificate_expires_at',
            type: 'date',
            required: false,
          },
          // Dados da Empresa Emissora
          {
            name: 'cnpj',
            type: 'text',
            required: false,
          },
          {
            name: 'razao_social',
            type: 'text',
            required: false,
          },
          {
            name: 'nome_fantasia',
            type: 'text',
            required: false,
          },
          {
            name: 'inscricao_estadual',
            type: 'text',
            required: false,
          },
          {
            name: 'regime_tributario',
            type: 'select',
            required: false,
            values: ['1', '2', '3'],
            maxSelect: 1,
          },
          {
            name: 'cnae',
            type: 'text',
            required: false,
          },
          // Endereço da Empresa
          {
            name: 'logradouro',
            type: 'text',
            required: false,
          },
          {
            name: 'numero',
            type: 'text',
            required: false,
          },
          {
            name: 'complemento',
            type: 'text',
            required: false,
          },
          {
            name: 'bairro',
            type: 'text',
            required: false,
          },
          {
            name: 'municipio',
            type: 'text',
            required: false,
          },
          {
            name: 'uf',
            type: 'text',
            required: false,
          },
          {
            name: 'cep',
            type: 'text',
            required: false,
          },
          {
            name: 'telefone',
            type: 'text',
            required: false,
          },
          {
            name: 'email',
            type: 'text',
            required: false,
          },
          // Parâmetros Fiscais Padrão para Venda de Notebook Usado
          {
            name: 'serie_nfe',
            type: 'text',
            required: false,
          },
          {
            name: 'proximo_numero_nfe',
            type: 'number',
            required: false,
          },
          {
            name: 'default_ncm',
            type: 'text',
            required: false,
          },
          {
            name: 'default_cfop_estadual',
            type: 'text',
            required: false,
          },
          {
            name: 'default_cfop_interestadual',
            type: 'text',
            required: false,
          },
          {
            name: 'default_csosn',
            type: 'text',
            required: false,
          },
          {
            name: 'natureza_operacao_padrao',
            type: 'text',
            required: false,
          },
          {
            name: 'informacoes_complementares_padrao',
            type: 'text',
            required: false,
          },
        ],
      })
      app.save(nfConfig)
      console.log('[0481] Colecao nf_config criada')
    }

    // 2. Criar coleção nf_invoices (Histórico, Snapshot e Emissão de Notas Fiscais)
    if (!app.hasTable('nf_invoices')) {
      const usersColRecord = app.findCollectionByNameOrId('users')

      const nfInvoices = new Collection({
        name: 'nf_invoices',
        type: 'base',
        listRule: AUTH_ALL,
        viewRule: AUTH_ALL,
        createRule: AUTH_ALL,
        updateRule: AUTH_ALL,
        deleteRule: AUTH_ALL,
        fields: [
          {
            name: 'ref',
            type: 'text',
            required: true,
          },
          {
            name: 'origin_type',
            type: 'select',
            required: true,
            values: ['ml_order', 'sale_internal', 'manual'],
            maxSelect: 1,
          },
          {
            name: 'ml_order_id',
            type: 'text',
            required: false,
          },
          {
            name: 'sale_id',
            type: 'text',
            required: false,
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: [
              'rascunho',
              'processando',
              'autorizada',
              'rejeitada',
              'cancelada',
              'erro_transmissao',
            ],
            maxSelect: 1,
          },
          {
            name: 'status_sefaz',
            type: 'text',
            required: false,
          },
          {
            name: 'mensagem_sefaz',
            type: 'text',
            required: false,
          },
          {
            name: 'numero',
            type: 'text',
            required: false,
          },
          {
            name: 'serie',
            type: 'text',
            required: false,
          },
          {
            name: 'chave_nfe',
            type: 'text',
            required: false,
          },
          {
            name: 'protocolo_autorizacao',
            type: 'text',
            required: false,
          },
          {
            name: 'caminho_danfe',
            type: 'text',
            required: false,
          },
          {
            name: 'caminho_xml_nota_fiscal',
            type: 'text',
            required: false,
          },
          {
            name: 'natureza_operacao',
            type: 'text',
            required: false,
          },
          {
            name: 'valor_total',
            type: 'number',
            required: false,
          },
          // Destinatário snapshot
          {
            name: 'destinatario',
            type: 'json',
            required: false,
          },
          // Itens da NF
          {
            name: 'itens',
            type: 'json',
            required: false,
          },
          // Informações complementares
          {
            name: 'informacoes_complementares',
            type: 'text',
            required: false,
          },
          // Payload enviado e resposta bruta da Focus NFe
          {
            name: 'focus_payload',
            type: 'json',
            required: false,
          },
          {
            name: 'focus_response',
            type: 'json',
            required: false,
          },
          {
            name: 'created_by',
            type: 'relation',
            required: false,
            collectionId: usersColRecord.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_nf_invoices_ref ON nf_invoices (ref)',
          'CREATE INDEX idx_nf_invoices_status ON nf_invoices (status)',
          'CREATE INDEX idx_nf_invoices_ml_order ON nf_invoices (ml_order_id)',
          'CREATE INDEX idx_nf_invoices_sale ON nf_invoices (sale_id)',
          'CREATE INDEX idx_nf_invoices_chave ON nf_invoices (chave_nfe)',
        ],
      })
      app.save(nfInvoices)
      console.log('[0481] Colecao nf_invoices criada')
    }
  },
  (app) => {
    try {
      const nfInvoices = app.findCollectionByNameOrId('nf_invoices')
      if (nfInvoices) app.delete(nfInvoices)
    } catch (_) {}

    try {
      const nfConfig = app.findCollectionByNameOrId('nf_config')
      if (nfConfig) app.delete(nfConfig)
    } catch (_) {}
  },
)
