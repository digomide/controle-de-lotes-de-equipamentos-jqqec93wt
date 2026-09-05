// Hook para criar ou atualizar contato automaticamente quando uma nova cotação corporativa é recebida
// Coleção: corporate_leads
// Tudo inline dentro do callback para respeitar a VM isolada do PocketBase v0.36 (Goja engine)

onRecordAfterCreateSuccess((e) => {
  const lead = e.record
  if (!lead) {
    e.next()
    return
  }

  const rawPhone = (lead.getString('phone') || '').trim()
  const rawName = (
    lead.getString('contact_name') ||
    lead.getString('company') ||
    'Lead Corporativo'
  ).trim()
  const rawProfile = (lead.getString('profile') || '').toLowerCase()

  if (!rawPhone) {
    e.next()
    return
  }

  // Normalização E.164 brasileira
  let digits = rawPhone.replace(/\D/g, '')
  if (digits.startsWith('0')) {
    digits = digits.slice(1)
  }
  if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) {
    digits = '55' + digits
  }

  if (digits.length < 12 || digits.length > 13) {
    // Não é um formato de telefone BR válido, apenas continua
    e.next()
    return
  }

  const e164Phone = '+' + digits

  let tipo = 'corporativo'
  if (rawProfile.includes('revendedor')) {
    tipo = 'revendedor'
  }

  const tags = ['cotacao_site', 'corporativo']
  if (tipo === 'revendedor') {
    tags.push('revenda')
  }

  try {
    const existing = $app.findFirstRecordByData('marketing_contacts', 'phone', e164Phone)
    if (existing) {
      // Já existe, enriquecer notas se aplicável
      const notes = existing.getString('notes') || ''
      const comp = lead.getString('company') || ''
      if (comp && !notes.includes(comp)) {
        existing.set('notes', (notes ? notes + '\n' : '') + 'Empresa: ' + comp)
        $app.save(existing)
      }
    }
  } catch (_) {
    // Não existe, criar novo contato
    try {
      const contactsCol = $app.findCollectionByNameOrId('marketing_contacts')
      const newContact = new Record(contactsCol)
      newContact.set('name', rawName)
      newContact.set('phone', e164Phone)
      newContact.set('tipo', tipo)
      newContact.set('source', 'cotacao')
      newContact.set('opt_in', true)
      newContact.set('status', 'ativo')
      newContact.set('tags', tags)
      newContact.set(
        'notes',
        'Gerado via cotação corporativa: ' + (lead.getString('company') || ''),
      )
      $app.save(newContact)
      console.log(
        '[marketing_lead_hook] Novo contato de marketing criado: ' +
          rawName +
          ' (' +
          e164Phone +
          ')',
      )
    } catch (saveErr) {
      console.log('[marketing_lead_hook] Erro ao criar contato de marketing: ' + saveErr)
    }
  }

  e.next()
}, 'corporate_leads')
