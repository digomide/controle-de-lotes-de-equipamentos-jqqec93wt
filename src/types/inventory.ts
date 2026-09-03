import type { RecordModel } from 'pocketbase'

export interface User extends RecordModel {
  email: string
  name: string
  role?: 'admin' | 'member'
  avatar?: string
}

export type ProductStatus = 'Disponível' | 'Reservado' | 'Vendido'

export interface TechnicalChecklistItem {
  item: string
  status: 'OK' | 'Atenção' | 'Não testado'
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
  aesthetic_grade?: string
  battery_health?: string
  screen_size?: string
  status?: ProductStatus
  images?: string[]
  photos?: string[]
  technical_checklist?: TechnicalChecklistItem[]
  history_events?: EquipmentHistoryEvent[]
  purchase_batch_id?: string
  serial_number?: string
  includes_charger?: boolean
  bench_notes?: string
  expand?: {
    purchase_batch_id?: PurchaseBatch
  }
}

export interface EquipmentPart extends RecordModel {
  product_id?: string
  purchase_batch_id?: string
  supplier?: string
  purchase_date?: string
  name: string
  cost?: number
  status: 'Pendente' | 'Trocado' | 'Instalado' | 'Danificado'
  notes?: string
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
  expand?: {
    user_id?: User
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
