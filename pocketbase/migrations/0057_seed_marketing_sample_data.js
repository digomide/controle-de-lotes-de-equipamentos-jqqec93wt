migrate(
  (app) => {
    const contactsCol = app.findCollectionByNameOrId('marketing_contacts')

    const initialContacts = [
      {
        name: 'Tech Minas Revenda e Informática',
        phone: '+5531992310866',
        tipo: 'revendedor',
        source: 'manual',
        opt_in: true,
        tags: ['revenda', 'lotes_grandes', 'bh'],
        notes: 'Revendedor parceiro de BH, compra lotes de ThinkPad e Dell Latitude.',
        status: 'ativo',
      },
      {
        name: 'Carlos Eduardo - Alpha Informática',
        phone: '+5511987654321',
        tipo: 'revendedor',
        source: 'import',
        opt_in: true,
        tags: ['revenda', 'sp', 'ultrabook'],
        notes: 'Interesse frequente em notebooks Core i7 com 16GB.',
        status: 'ativo',
      },
      {
        name: 'Grupo Soluções Corporativas Ltda',
        phone: '+5531988887777',
        tipo: 'corporativo',
        source: 'cotacao',
        opt_in: true,
        tags: ['corporativo', 'nf_empresa', 'ti_interno'],
        notes: 'Demanda de 10 a 20 máquinas por semestre para equipe de desenvolvimento.',
        status: 'ativo',
      },
      {
        name: 'Lucas Ferreira',
        phone: '+5521997651234',
        tipo: 'cliente',
        source: 'compra',
        opt_in: true,
        tags: ['cliente_final', 'home_office'],
        notes: 'Comprou notebook Dell para trabalho home office.',
        status: 'ativo',
      },
    ]

    for (let i = 0; i < initialContacts.length; i++) {
      const c = initialContacts[i]
      try {
        app.findFirstRecordByData('marketing_contacts', 'phone', c.phone)
        // Já existe
      } catch (_) {
        const rec = new Record(contactsCol)
        rec.set('name', c.name)
        rec.set('phone', c.phone)
        rec.set('tipo', c.tipo)
        rec.set('source', c.source)
        rec.set('opt_in', c.opt_in)
        rec.set('tags', c.tags)
        rec.set('notes', c.notes)
        rec.set('status', c.status)
        app.save(rec)
      }
    }

    // Criar uma campanha modelo inicial
    const campaignsCol = app.findCollectionByNameOrId('marketing_campaigns')
    try {
      const existingCamps = app.findRecordsByFilter('marketing_campaigns', '1=1', '-created', 1, 0)
      if (!existingCamps || existingCamps.length === 0) {
        // Buscar um produto disponível para vincular se houver
        let sampleProductId = null
        try {
          const prodRecords = app.findRecordsByFilter(
            'products',
            "status = 'Disponível'",
            '-created',
            1,
            0,
          )
          if (prodRecords && prodRecords.length > 0) {
            sampleProductId = prodRecords[0].id
          }
        } catch (_) {}

        const campRec = new Record(campaignsCol)
        campRec.set('name', 'Lote de Boas-Vindas - Revendedores AMbicorpFlow')
        campRec.set('channel', 'whatsapp')
        campRec.set('batch_notice', true)
        if (sampleProductId) {
          campRec.set('product_id', sampleProductId)
        }
        campRec.set('audience_filter', { tipo: 'revendedor' })
        campRec.set(
          'message_body',
          'Olá {{nome}}, tudo bem?\n\nAcabou de chegar um novo lote corporativo aqui na AMbicorpFlow:\n📦 *{{produto}}*\n🏷️ Preço de lote: *{{preco}}*\n\nEquipamentos testados, revisados e com garantia.\nConfira fotos e ficha técnica completa:\n👉 {{link_loja}}\n\nPodemos separar um lote para você? Chame no WhatsApp: {{whatsapp}}',
        )
        campRec.set('status', 'rascunho')
        campRec.set('stats', { total_destinatarios: 2, enviados: 0, erros: 0 })
        app.save(campRec)
      }
    } catch (_) {}
  },
  (app) => {
    // Rollback opcional
  },
)
