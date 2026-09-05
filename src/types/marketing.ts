export type MarketingContactTipo = 'revendedor' | 'cliente' | 'corporativo'
export type MarketingContactSource = 'manual' | 'import' | 'compra' | 'cotacao'
export type MarketingContactStatus = 'ativo' | 'inativo'

export interface MarketingContact {
  id: string
  name: string
  phone: string // E.164 ex: +5531992310866
  tipo: MarketingContactTipo
  tags?: string[]
  source: MarketingContactSource
  opt_in: boolean
  last_sent_at?: string
  notes?: string
  status: MarketingContactStatus
  created: string
  updated: string
}

export type MarketingChannel = 'whatsapp' | 'instagram' | 'ambos'
export type MarketingCampaignStatus =
  | 'rascunho'
  | 'agendada'
  | 'enviando'
  | 'pausada'
  | 'concluida'
  | 'erro'

export interface MarketingCampaignAudienceFilter {
  tipo?: 'todos' | MarketingContactTipo
  tags?: string[]
}

export interface MarketingCampaignStats {
  total_destinatarios?: number
  total?: number
  enviados?: number
  erros?: number
  sem_credencial?: number
  processed_at?: string
  has_credentials?: boolean
  note?: string
}

export interface MarketingCampaign {
  id: string
  name: string
  channel: MarketingChannel
  template_key?: string
  product_id?: string
  batch_notice?: boolean
  message_body: string
  audience_filter?: MarketingCampaignAudienceFilter
  status: MarketingCampaignStatus
  scheduled_at?: string
  stats?: MarketingCampaignStats
  created: string
  updated: string
  expand?: {
    product_id?: {
      id: string
      name: string
      model?: string
      brand?: string
      unit_price?: number
      sku?: string
      photos?: string[]
      images?: string[]
    }
  }
}

export type MarketingMessageStatus =
  | 'pendente'
  | 'enviado'
  | 'entregue'
  | 'lido'
  | 'falhou'
  | 'sem_credencial'

export interface MarketingMessage {
  id: string
  campaign_id: string
  contact_id: string
  phone: string
  body_final?: string
  wa_message_id?: string
  status: MarketingMessageStatus
  error?: string
  sent_at?: string
  created: string
  updated: string
  expand?: {
    contact_id?: MarketingContact
    campaign_id?: MarketingCampaign
  }
}

export interface MarketingSettings {
  id?: string
  meta_wa_token?: string
  meta_wa_phone_number_id?: string
  meta_wa_business_account_id?: string
  instagram_user_id?: string
  instagram_token?: string
  sender_phone_display?: string
  notes?: string
  created?: string
  updated?: string
}

export interface MarketingConnectionTestResult {
  whatsapp: {
    configured: boolean
    ok: boolean
    message: string
    data?: any
  }
  instagram: {
    configured: boolean
    ok: boolean
    message: string
    data?: any
  }
}
