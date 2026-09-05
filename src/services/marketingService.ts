import pb from '@/lib/pocketbase/client'
import type {
  MarketingContact,
  MarketingContactTipo,
  MarketingContactStatus,
  MarketingContactSource,
  MarketingCampaign,
  MarketingMessage,
  MarketingSettings,
  MarketingConnectionTestResult,
} from '@/types/marketing'

/**
 * Normaliza e valida um telefone brasileiro para o formato E.164 (+55...)
 */
export function normalizePhoneBR(raw: string): {
  valid: boolean
  e164: string
  formatted: string
  error?: string
} {
  if (!raw) return { valid: false, e164: '', formatted: '', error: 'Telefone vazio' }

  let digits = raw.replace(/\D/g, '')

  // Remove zero à esquerda do DDD
  if (digits.startsWith('0')) {
    digits = digits.slice(1)
  }

  // Se não começa com 55 e tem 10 ou 11 dígitos, adiciona 55
  if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) {
    digits = '55' + digits
  }

  // Um número brasileiro válido com 55 tem 12 ou 13 dígitos (55 + 2 DDD + 8 ou 9 dígitos)
  if (digits.length < 12 || digits.length > 13) {
    return {
      valid: false,
      e164: '',
      formatted: raw,
      error: `Formato inválido (${digits.length} dígitos). Esperado: DDD + 8 ou 9 dígitos.`,
    }
  }

  const ddd = digits.slice(2, 4)
  const number = digits.slice(4)
  const formatted = `(${ddd}) ${number.length === 9 ? number.slice(0, 5) + '-' + number.slice(5) : number.slice(0, 4) + '-' + number.slice(4)}`
  const e164 = `+${digits}`

  return { valid: true, e164, formatted }
}

export const marketingService = {
  // ================= CONTATOS =================
  async getContacts(params?: {
    search?: string
    tipo?: string
    status?: string
    sort?: string
    page?: number
    perPage?: number
  }) {
    const filters: string[] = []

    if (params?.tipo && params.tipo !== 'todos') {
      filters.push(`tipo = "${params.tipo}"`)
    }
    if (params?.status && params.status !== 'todos') {
      filters.push(`status = "${params.status}"`)
    }
    if (params?.search) {
      const q = params.search.replace(/["\\]/g, '')
      filters.push(`(name ~ "${q}" || phone ~ "${q}" || notes ~ "${q}")`)
    }

    const filter = filters.join(' && ')
    const sort = params?.sort || '-created'
    const page = params?.page || 1
    const perPage = params?.perPage || 100

    return await pb.collection('marketing_contacts').getList<MarketingContact>(page, perPage, {
      filter,
      sort,
    })
  },

  async getAllContacts() {
    return await pb.collection('marketing_contacts').getFullList<MarketingContact>({
      sort: '-created',
    })
  },

  async createContact(data: {
    name: string
    phone: string
    tipo: MarketingContactTipo
    tags?: string[]
    source?: MarketingContactSource
    opt_in?: boolean
    notes?: string
    status?: MarketingContactStatus
  }) {
    const phoneVal = normalizePhoneBR(data.phone)
    if (!phoneVal.valid) {
      throw new Error(phoneVal.error || 'Telefone inválido')
    }

    return await pb.collection('marketing_contacts').create<MarketingContact>({
      name: data.name.trim(),
      phone: phoneVal.e164,
      tipo: data.tipo,
      tags: data.tags || [],
      source: data.source || 'manual',
      opt_in: data.opt_in !== false,
      notes: data.notes || '',
      status: data.status || 'ativo',
    })
  },

  async updateContact(id: string, data: Partial<MarketingContact>) {
    const payload: any = { ...data }
    if (data.phone) {
      const phoneVal = normalizePhoneBR(data.phone)
      if (!phoneVal.valid) throw new Error(phoneVal.error || 'Telefone inválido')
      payload.phone = phoneVal.e164
    }
    return await pb.collection('marketing_contacts').update<MarketingContact>(id, payload)
  },

  async deleteContact(id: string) {
    return await pb.collection('marketing_contacts').delete(id)
  },

  /**
   * Importação em massa de contatos a partir de texto (CSV ou linha por linha "Nome;Telefone;Tipo")
   */
  async importContactsBatch(
    rawText: string,
    defaultTipo: MarketingContactTipo = 'cliente',
  ): Promise<{
    imported: number
    skipped: number
    errors: { line: number; raw: string; error: string }[]
  }> {
    const lines = rawText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    let imported = 0
    let skipped = 0
    const errors: { line: number; raw: string; error: string }[] = []

    // Carregar telefones existentes para evitar duplicados
    const existing = await pb.collection('marketing_contacts').getFullList<{ phone: string }>({
      fields: 'phone',
    })
    const existingPhones = new Set(existing.map((e) => e.phone))

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // Ignorar cabeçalhos comuns se presentes
      if (
        i === 0 &&
        (line.toLowerCase().includes('nome') || line.toLowerCase().includes('telefone'))
      ) {
        continue
      }

      // Separadores: vírgula, ponto-e-vírgula ou tabulação
      const parts = line.split(/[;,\t]/).map((p) => p.trim())
      if (parts.length < 2) {
        errors.push({
          line: i + 1,
          raw: line,
          error: 'Formato inválido. Esperado "Nome; Telefone"',
        })
        continue
      }

      const name = parts[0]
      const rawPhone = parts[1]
      const tipoPart = parts[2]?.toLowerCase()
      let tipo: MarketingContactTipo = defaultTipo
      if (tipoPart === 'revendedor' || tipoPart === 'revenda') tipo = 'revendedor'
      else if (tipoPart === 'corporativo' || tipoPart === 'empresa') tipo = 'corporativo'
      else if (tipoPart === 'cliente') tipo = 'cliente'

      const norm = normalizePhoneBR(rawPhone)
      if (!norm.valid) {
        errors.push({ line: i + 1, raw: line, error: norm.error || 'Telefone inválido' })
        continue
      }

      if (existingPhones.has(norm.e164)) {
        skipped++
        continue
      }

      try {
        await pb.collection('marketing_contacts').create({
          name: name || 'Contato ' + norm.e164,
          phone: norm.e164,
          tipo,
          source: 'import',
          opt_in: true,
          status: 'ativo',
          tags: ['importado_massa'],
        })
        existingPhones.add(norm.e164)
        imported++
      } catch (err: any) {
        errors.push({ line: i + 1, raw: line, error: err.message || 'Erro ao persistir contato' })
      }
    }

    return { imported, skipped, errors }
  },

  // ================= CAMPANHAS =================
  async getCampaigns(params?: { status?: string }) {
    const filters: string[] = []
    if (params?.status && params.status !== 'todos') {
      filters.push(`status = "${params.status}"`)
    }
    return await pb.collection('marketing_campaigns').getFullList<MarketingCampaign>({
      filter: filters.join(' && '),
      sort: '-created',
      expand: 'product_id',
    })
  },

  async getCampaignById(id: string) {
    return await pb.collection('marketing_campaigns').getOne<MarketingCampaign>(id, {
      expand: 'product_id',
    })
  },

  async createCampaign(data: {
    name: string
    channel: 'whatsapp' | 'instagram' | 'ambos'
    product_id?: string
    batch_notice?: boolean
    message_body: string
    audience_filter?: { tipo?: 'todos' | MarketingContactTipo; tags?: string[] }
    status?: 'rascunho' | 'agendada' | 'enviando'
    scheduled_at?: string
  }) {
    return await pb.collection('marketing_campaigns').create<MarketingCampaign>({
      name: data.name,
      channel: data.channel,
      product_id: data.product_id || null,
      batch_notice: Boolean(data.batch_notice),
      message_body: data.message_body,
      audience_filter: data.audience_filter || { tipo: 'todos' },
      status: data.status || 'rascunho',
      scheduled_at: data.scheduled_at || null,
      stats: { total: 0, enviados: 0, erros: 0 },
    })
  },

  async updateCampaign(id: string, data: Partial<MarketingCampaign>) {
    return await pb.collection('marketing_campaigns').update<MarketingCampaign>(id, data)
  },

  async deleteCampaign(id: string) {
    return await pb.collection('marketing_campaigns').delete(id)
  },

  /**
   * Dispara o processamento de uma campanha chamando o endpoint do backend
   */
  async triggerCampaignProcess(campaignId: string) {
    const res = await pb.send<{
      success: boolean
      campaign_id: string
      status: string
      stats: any
      message: string
    }>(`/api/marketing/process-campaign/${campaignId}`, {
      method: 'POST',
    })
    return res
  },

  // ================= MENSAGENS / LOGS =================
  async getCampaignMessages(campaignId: string) {
    return await pb.collection('marketing_messages').getFullList<MarketingMessage>({
      filter: `campaign_id = "${campaignId}"`,
      sort: '-created',
      expand: 'contact_id',
    })
  },

  // ================= CONFIGURAÇÕES DE INTEGRAÇÃO =================
  async getSettings(): Promise<MarketingSettings> {
    try {
      const list = await pb.collection('marketing_settings').getFullList<MarketingSettings>({
        sort: '-created',
        limit: 1,
      })
      if (list.length > 0) return list[0]
    } catch {
      /* intentionally ignored */
    }
    return {
      sender_phone_display: '(31) 99231-0866',
    }
  },

  async saveSettings(data: {
    meta_wa_token?: string
    meta_wa_phone_number_id?: string
    meta_wa_business_account_id?: string
    instagram_user_id?: string
    instagram_token?: string
    sender_phone_display?: string
    notes?: string
  }): Promise<MarketingSettings> {
    const current = await this.getSettings()
    if (current.id) {
      return await pb.collection('marketing_settings').update<MarketingSettings>(current.id, data)
    } else {
      return await pb.collection('marketing_settings').create<MarketingSettings>(data)
    }
  },

  async testConnection(credentials?: {
    meta_wa_token?: string
    meta_wa_phone_number_id?: string
    instagram_token?: string
    instagram_user_id?: string
  }): Promise<MarketingConnectionTestResult> {
    const res = await pb.send<MarketingConnectionTestResult>('/api/marketing/test-connection', {
      method: 'POST',
      body: credentials || {},
    })
    return res
  },
}
