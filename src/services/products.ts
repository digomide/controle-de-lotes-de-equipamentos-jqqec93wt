import pb from '@/lib/pocketbase/client'
import type { Product, Batch } from '@/types/inventory'

export const productsService = {
  async getAll(): Promise<Product[]> {
    return await pb.collection('products').getFullList<Product>({
      sort: '-created',
      expand: 'purchase_batch_id',
    })
  },

  async getById(id: string): Promise<Product> {
    return await pb.collection('products').getOne<Product>(id, {
      expand: 'purchase_batch_id',
    })
  },

  async getByCodeOrSku(identifier: string): Promise<Product | null> {
    try {
      // 1. Direct match on product code, sku or id
      const records = await pb.collection('products').getFullList<Product>({
        filter: `code = "${identifier}" || sku = "${identifier}" || id = "${identifier}"`,
      })
      if (records[0]) return records[0]

      // 2. Check if identifier matches a batch_number or batch id
      try {
        const batchRecords = await pb.collection('batches').getFullList<Batch>({
          filter: `batch_number = "${identifier}" || id = "${identifier}"`,
          expand: 'product_id',
        })
        if (batchRecords[0]?.expand?.product_id) {
          return batchRecords[0].expand.product_id
        }
        if (batchRecords[0]?.product_id) {
          return await pb.collection('products').getOne<Product>(batchRecords[0].product_id)
        }
      } catch {
        // ignore and fallback
      }

      return null
    } catch {
      return null
    }
  },

  async create(data: Partial<Product> | FormData): Promise<Product> {
    return await pb.collection('products').create<Product>(data)
  },

  async update(id: string, data: Partial<Product> | FormData): Promise<Product> {
    return await pb.collection('products').update<Product>(id, data)
  },

  getFileUrl(record: Product, filename: string): string {
    return pb.files.getURL(record, filename)
  },

  async updateStatus(id: string, status: 'Disponível' | 'Reservado' | 'Vendido'): Promise<Product> {
    return await pb.collection('products').update<Product>(id, { status })
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('products').delete(id)
  },
}
