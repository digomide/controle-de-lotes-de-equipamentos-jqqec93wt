export type GeneralInventoryMovementType = 'entrada' | 'saida' | 'ajuste'

import type { RecordModel } from 'pocketbase'

export interface GeneralInventoryItem extends RecordModel {
  description: string
  category: string
  quantity: number
  cost_price: number
  suggested_price: number
  min_stock: number
  location?: string
  notes?: string
}

export interface GeneralInventoryMovement extends RecordModel {
  item_id: string
  type: GeneralInventoryMovementType
  quantity: number
  quantity_before?: number
  quantity_after?: number
  unit_cost?: number
  reason?: string
  observation?: string
  user_id?: string
  expand?: {
    item_id?: GeneralInventoryItem
    user_id?: {
      id: string
      name: string
      email: string
      role?: string
    }
  }
}

export const GENERAL_INVENTORY_CATEGORIES = [
  'Memória',
  'HD/SSD',
  'Monitor',
  'Placa-mãe',
  'Fonte',
  'Carcaça',
  'Acessório',
  'Cabo/Adaptador',
  'Bateria',
  'Teclado',
  'Outros',
] as const

export type GeneralInventoryCategory = (typeof GENERAL_INVENTORY_CATEGORIES)[number]
