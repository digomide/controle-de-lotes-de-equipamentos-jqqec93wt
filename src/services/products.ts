import pb from '@/lib/pocketbase/client'
import type { Product } from '@/types/inventory'

export const productsService = {
  async getAll(): Promise<Product[]> {
    return await pb.collection('products').getFullList<Product>({
      sort: '-created',
    })
  },

  async getById(id: string): Promise<Product> {
    return await pb.collection('products').getOne<Product>(id)
  },

  async getByCodeOrSku(identifier: string): Promise<Product | null> {
    try {
      const records = await pb.collection('products').getFullList<Product>({
        filter: `code = "${identifier}" || sku = "${identifier}" || id = "${identifier}"`,
      })
      return records[0] || null
    } catch {
      return null
    }
  },

  async create(data: Partial<Product>): Promise<Product> {
    return await pb.collection('products').create<Product>(data)
  },

  async update(id: string, data: Partial<Product>): Promise<Product> {
    return await pb.collection('products').update<Product>(id, data)
  },

  async updateStatus(id: string, status: 'Disponível' | 'Reservado' | 'Vendido'): Promise<Product> {
    return await pb.collection('products').update<Product>(id, { status })
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('products').delete(id)
  },
}
