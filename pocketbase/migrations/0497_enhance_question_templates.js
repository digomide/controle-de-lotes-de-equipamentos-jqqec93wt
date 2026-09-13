/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Atualizar ou adicionar templates para Dúvidas Recorrentes (Compatibilidade, Acessórios/Monitor, etc.)
    if (!app.hasTable('ml_question_templates')) {
      return
    }

    const col = app.findCollectionByNameOrId('ml_question_templates')

    const newTemplates = [
      {
        title: 'Compatibilidade de Peças e Modelos',
        category: 'tecnico',
        keywords: [
          'compativel',
          'compatível',
          'serve',
          'funciona',
          'aceita',
          'compatibilidade',
          'modelo',
          'kvr',
          'ddr3',
          'ddr4',
          'ideapad',
          'vostro',
          'optiplex',
          'inspirion',
          'inspiron',
          's145',
          'e20',
          'notebook',
          'desktop',
        ],
        content:
          'Olá! Peça padrão original testada. Para garantir 100% de compatibilidade com seu modelo/part number (PN), consulte o padrão de barramento/frequência e encaixe nas especificações técnicas ou nos envie o modelo exato para conferência técnica imediata!',
        use_stock_placeholder: false,
        times_used: 0,
        active: true,
      },
      {
        title: 'Acessórios Inclusos e Monitor',
        category: 'conteudo',
        keywords: [
          'monitor',
          'tela',
          'teclado',
          'mouse',
          'cabo',
          'acompanha',
          'vem com',
          'incluso',
          'itens inclusos',
          'adaptador',
          'acessorios',
          'acessórios',
        ],
        content:
          'Olá! O anúncio refere-se exatamente à unidade descrita no título (CPU desktop ou peça individual). Não acompanha monitor ou periféricos extras, exceto quando expressamente listado nos itens inclusos. Acompanha cabo de alimentação/energia para uso imediato.',
        use_stock_placeholder: false,
        times_used: 0,
        active: true,
      },
      {
        title: 'Sistema Operacional e Configuração',
        category: 'software',
        keywords: [
          'windows',
          'w10',
          'w11',
          'sistema',
          'formatado',
          'ativado',
          'original',
          'pronto para uso',
        ],
        content:
          'Olá! Enviamos o equipamento formatado e pronto para uso com Windows e drivers essenciais instalados em bancada para você ligar e trabalhar imediatamente com total segurança.',
        use_stock_placeholder: false,
        times_used: 0,
        active: true,
      },
      {
        title: 'Peças de Carcaça e Gabinete',
        category: 'carcaca',
        keywords: [
          'tampa',
          'carcaca',
          'carcaça',
          'screen cover',
          'dobradiça',
          'dobradica',
          'moldura',
          'base',
          'inferior',
          'superior',
        ],
        content:
          'Olá! Peça de reposição original e revisada, com travas e pontos de fixação intactos. Verifique o part number e fotos reais do produto para confirmação com seu modelo.',
        use_stock_placeholder: false,
        times_used: 0,
        active: true,
      },
    ]

    for (let i = 0; i < newTemplates.length; i++) {
      const t = newTemplates[i]
      try {
        const existing = app.findRecordsByFilter(
          'ml_question_templates',
          `title = "${t.title.replace(/"/g, '\\"')}"`,
          '-created',
          1,
          0,
        )
        if (!existing || existing.length === 0) {
          const rec = new Record(col)
          rec.set('title', t.title)
          rec.set('category', t.category)
          rec.set('keywords', t.keywords)
          rec.set('content', t.content)
          rec.set('use_stock_placeholder', t.use_stock_placeholder)
          rec.set('times_used', t.times_used)
          rec.set('active', t.active)
          app.save(rec)
          console.log('[0497] Template criado: ' + t.title)
        }
      } catch (err) {
        console.log('[0497] Aviso ao inserir template ' + t.title + ': ' + err)
      }
    }
  },
  (app) => {
    // Down migration: rollback opcional
  },
)
