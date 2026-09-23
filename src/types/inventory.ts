import type { RecordModel } from 'pocketbase'

export interface User extends RecordModel {
  email: string
  name: string
  role?: 'super_admin' | 'admin' | 'member'
  tenant_id?: string
  active?: boolean
  avatar?: string
}

export type ProductStatus = 'Disponível' | 'Reservado' | 'Vendido' | 'Pendente de ativação'

export type ChecklistItemStatus = 'Ok' | 'OK' | 'Atenção' | 'Falha' | 'Não testado' | 'N/A'

export interface TechnicalChecklistItem {
  item: string
  status: ChecklistItemStatus
  observation?: string
}

export interface EquipmentHistoryEvent {
  title: string
  date: string
}

export type PurchaseBatchStatus = 'em_processamento' | 'concluido'

export interface PurchaseBatch extends RecordModel {
  supplier: string
  invoice_number?: string
  purchase_date?: string
  total_cost: number
  expected_quantity: number
  status: PurchaseBatchStatus
  location?: string
  notes?: string
  expand?: {
    products_via_purchase_batch_id?: Product[]
  }
}

export interface Product extends RecordModel {
  name: string
  sku: string
  code?: string
  description?: string
  category: string
  unit_price: number
  cost_price?: number
  brand?: string
  model?: string
  processor?: string
  ram?: string
  storage?: string
  condition?: string
  condition_type?: 'novo' | 'usado' | 'recondicionado' | 'caixa_aberta'
  condition_grade?: 'excelente' | 'bom' | 'aceitavel'
  aesthetic_grade?: string
  battery_health?: string
  screen_size?: string
  has_numeric_keypad?: boolean
  status?: ProductStatus
  images?: string[]
  photos?: string[]
  photo_order?: Array<{ type: 'photo' | 'image'; value: string }>
  technical_checklist?: TechnicalChecklistItem[]
  history_events?: EquipmentHistoryEvent[]
  purchase_batch_id?: string
  serial_number?: string
  part_number?: string
  gtin?: string
  includes_charger?: boolean
  bench_notes?: string
  ml_listing_id?: string
  ml_listing_url?: string
  ml_listing_status?: 'active' | 'paused' | 'closed' | string
  ml_published_at?: string
  catalog_product_id?: string
  expand?: {
    purchase_batch_id?: PurchaseBatch
  }
}

export type EquipmentPartStatus =
  | 'Pendente'
  | 'Orçada'
  | 'Comprada'
  | 'Recebida'
  | 'Instalada'
  | 'Instalado'
  | 'Trocado'
  | 'Danificado'

export interface EquipmentPart extends RecordModel {
  product_id?: string
  purchase_batch_id?: string
  supplier?: string
  purchase_date?: string
  name: string
  cost?: number
  quantity?: number
  status: EquipmentPartStatus
  notes?: string
  tenant_id?: string
  expand?: {
    product_id?: Product
    purchase_batch_id?: PurchaseBatch
  }
}

export interface EquipmentDeliverable extends RecordModel {
  product_id: string
  item_name: string
  status: 'Pendente' | 'Resolvido'
  notes?: string
}

export interface Batch extends RecordModel {
  product_id: string
  batch_number: string
  quantity: number
  location?: string
  manufacturing_date?: string
  expiry_date?: string
  expand?: {
    product_id?: Product
  }
}

export interface Sale extends RecordModel {
  user_id?: string
  customer_name: string
  customer_contact?: string
  total_amount: number
  status: 'draft' | 'completed' | 'cancelled'
  notes?: string
  cancel_reason?: string
  cancelled_at?: string
  cancelled_by?: string
  expand?: {
    user_id?: User
    cancelled_by?: User
    sale_items_via_sale_id?: SaleItem[]
  }
}

export interface SaleItem extends RecordModel {
  sale_id: string
  product_id: string
  batch_id: string
  quantity: number
  unit_price: number
  subtotal: number
  expand?: {
    product_id?: Product
    batch_id?: Batch
  }
}

export interface InventoryAdjustment extends RecordModel {
  batch_id: string
  user_id?: string
  type: 'count_adjustment' | 'manual_entry' | 'return'
  quantity_before?: number
  physical_count?: number
  quantity_change: number
  reason?: string
  expand?: {
    batch_id?: Batch & { expand?: { product_id?: Product } }
    user_id?: User
  }
}

export type SocialPostFormat = 'tecnico' | 'urgencia' | 'lote' | 'achadinho' | 'revendedor'
export type SocialPostStatus = 'Pendente' | 'Postado'
export type SocialPostPlatform = 'instagram' | 'tiktok'

export interface SocialPost extends RecordModel {
  product_id: string
  status: SocialPostStatus
  format?: SocialPostFormat
  platform?: SocialPostPlatform
  caption?: string
  posted_at?: string
  notes?: string
  expand?: {
    product_id?: Product
  }
}

export type CorporateLeadProfile = 'Revendedor' | 'Empresa — uso interno'
export type CorporateLeadStatus = 'novo' | 'atendido'

export interface CorporateLead extends RecordModel {
  company: string
  contact_name: string
  email: string
  phone: string
  profile: CorporateLeadProfile
  interest?: string
  quantity?: string
  message?: string
  status: CorporateLeadStatus
}

export type StoreOrderStatus = 'pendente' | 'aprovado' | 'recusado' | 'cancelado' | 'expirado'
export type StoreOrderOrigin = 'loja' | 'whatsapp'

export interface StoreOrder extends RecordModel {
  product_id: string
  batch_id?: string
  quantity: number
  unit_price: number
  total_amount: number
  customer_name: string
  customer_phone: string
  customer_email?: string
  customer_document?: string
  status: StoreOrderStatus
  origin: StoreOrderOrigin
  mp_preference_id?: string
  mp_payment_id?: string
  mp_init_point?: string
  mp_status_detail?: string
  payment_method_id?: string
  stock_decremented?: boolean
  paid_at?: string
  notes?: string
  expand?: {
    product_id?: Product
    batch_id?: Batch
  }
}

export interface MercadoPagoSettings extends RecordModel {
  mp_access_token: string
  mp_public_key: string
  mp_enabled: boolean
  store_title?: string
  statement_descriptor?: string
  webhook_secret?: string
  notes?: string
}
