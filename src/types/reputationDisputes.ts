export type DisputeExclusionStatus =
  | 'Nao solicitada'
  | 'Solicitada'
  | 'Recusada'
  | 'Mediacao'
  | 'Nao se aplica'

export type DisputeStatus =
  | 'Para redigir'
  | 'Pronto para contato'
  | 'Contato feito'
  | 'Enviado ao ML'
  | 'Resolvido'
  | 'Recusado'

export interface MLReputationDispute {
  id: string
  created: string
  updated: string
  sale_id_ml: string
  sale_date?: string
  product_title?: string
  problems_count?: number
  reputation_impact?: string
  exclusion_status?: DisputeExclusionStatus
  exclusion_detail?: string
  claim_id?: string
  customer_name?: string
  customer_nickname?: string
  customer_phone?: string
  claim_reason?: string
  defense_text?: string
  dispute_status: DisputeStatus
  contact_history?: string
  ml_order_ref?: string
  tenant_id?: string
}

export interface CreateDisputeInput {
  sale_id_ml: string
  sale_date?: string
  product_title?: string
  problems_count?: number
  reputation_impact?: string
  exclusion_status?: DisputeExclusionStatus
  exclusion_detail?: string
  claim_id?: string
  customer_name?: string
  customer_nickname?: string
  customer_phone?: string
  claim_reason?: string
  defense_text?: string
  dispute_status?: DisputeStatus
  contact_history?: string
  ml_order_ref?: string
  tenant_id?: string
}

export interface UpdateDisputeInput {
  sale_id_ml?: string
  sale_date?: string
  product_title?: string
  problems_count?: number
  reputation_impact?: string
  exclusion_status?: DisputeExclusionStatus
  exclusion_detail?: string
  claim_id?: string
  customer_name?: string
  customer_nickname?: string
  customer_phone?: string
  claim_reason?: string
  defense_text?: string
  dispute_status?: DisputeStatus
  contact_history?: string
  ml_order_ref?: string
  tenant_id?: string
}

export interface SyncClaimsResponse {
  ok: boolean
  api_available: boolean
  api_status_code: number
  claims_found: number
  local_orders_linked: number
  warning?: string | null
  message: string
}
