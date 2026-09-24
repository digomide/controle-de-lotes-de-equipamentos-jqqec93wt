import pb from '@/lib/pocketbase/client'
import type { Batch } from '@/types/inventory'

export const batchesService = {
  async getAll(tenantId?: string): Promise<Batch[]> {
    const filter = tenantId ? `tenant_id = '${tenantId}'` : ''
    return await pb.collection('batches').getFullList<Batch>({
      filter,
      expand: 'product_id',
      sort: '-created',
    })
  },

  async getByProductId(productId: string): Promise<Batch[]> {
    return await pb.collection('batches').getFullList<Batch>({
      filter: `product_id = "${productId}"`,
      expand: 'product_id',
      sort: '-created',
    })
  },

  async getById(id: string): Promise<Batch> {
    return await pb.collection('batches').getOne<Batch>(id, {
      expand: 'product_id',
    })
  },

  async create(data: {
    product_id: string
    batch_number: string
    quantity: number
    location?: string
    manufacturing_date?: string
    expiry_date?: string
    tenant_id?: string
  }): Promise<Batch> {
    return await pb.collection('batches').create<Batch>(data, {
      expand: 'product_id',
    })
  },

  async update(id: string, data: Partial<Batch>): Promise<Batch> {
    return await pb.collection('batches').update<Batch>(id, data, {
      expand: 'product_id',
    })
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('batches').delete(id)
  },
}
