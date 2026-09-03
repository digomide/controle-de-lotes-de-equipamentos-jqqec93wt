import pb from '@/lib/pocketbase/client'
import type { InventoryAdjustment } from '@/types/inventory'

export interface CreateAdjustmentInput {
  batch_id: string
  type: 'count_adjustment' | 'manual_entry' | 'return'
  physical_count?: number
  quantity_before?: number
  quantity_change: number
  reason?: string
}

export const adjustmentsService = {
  async getAll(): Promise<InventoryAdjustment[]> {
    return await pb.collection('inventory_adjustments').getFullList<InventoryAdjustment>({
      expand: 'batch_id,batch_id.product_id,user_id',
      sort: '-created',
    })
  },

  async create(input: CreateAdjustmentInput): Promise<InventoryAdjustment> {
    const userId = pb.authStore.record?.id
    // Backend hook handles updating the batch quantity!
    return await pb.collection('inventory_adjustments').create<InventoryAdjustment>(
      {
        batch_id: input.batch_id,
        user_id: userId,
        type: input.type,
        quantity_before: input.quantity_before,
        physical_count: input.physical_count,
        quantity_change: input.quantity_change,
        reason: input.reason || '',
      },
      {
        expand: 'batch_id,batch_id.product_id,user_id',
      },
    )
  },
}
