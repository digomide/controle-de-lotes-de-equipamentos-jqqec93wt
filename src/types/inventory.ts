import type { RecordModel } from 'pocketbase'

export interface User extends RecordModel {
  email: string
  name: string
  role?: 'admin' | 'member'
  avatar?: string
}

export interface Product extends RecordModel {
  name: string
  sku: string
  description?: string
  category: string
  unit_price: number
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
