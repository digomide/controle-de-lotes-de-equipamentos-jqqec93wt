import pb from '@/lib/pocketbase/client'
import type { PurchaseBatch, Product } from '@/types/inventory'

export interface CreatePurchaseBatchInput {
  supplier: string
  invoice_number?: string
  purchase_date?: string
  total_cost: number
  expected_quantity: number
  status?: 'em_processamento' | 'concluido'
}

export const purchaseBatchesService = {
  async getAll(): Promise<PurchaseBatch[]> {
    return await pb.collection('purchase_batches').getFullList<PurchaseBatch>({
      sort: '-purchase_date,-created',
    })
  },

  async getById(id: string): Promise<PurchaseBatch> {
    return await pb.collection('purchase_batches').getOne<PurchaseBatch>(id)
  },

  async create(data: CreatePurchaseBatchInput): Promise<PurchaseBatch> {
    return await pb.collection('purchase_batches').create<PurchaseBatch>({
      ...data,
      status: data.status || 'em_processamento',
    })
  },

  async update(id: string, data: Partial<PurchaseBatch>): Promise<PurchaseBatch> {
    return await pb.collection('purchase_batches').update<PurchaseBatch>(id, data)
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('purchase_batches').delete(id)
  },

  async getProductsByBatchId(batchId: string): Promise<Product[]> {
    return await pb.collection('products').getFullList<Product>({
      filter: `purchase_batch_id = "${batchId}"`,
      sort: '-created',
    })
  },
}
