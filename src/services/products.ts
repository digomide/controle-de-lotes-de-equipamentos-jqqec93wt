import pb from '@/lib/pocketbase/client'
import type { Product } from '@/types/inventory'

export const productsService = {
  async getAll(): Promise<Product[]> {
    return await pb.collection('products').getFullList<Product>({
      sort: 'name',
    })
  },

  async getById(id: string): Promise<Product> {
    return await pb.collection('products').getOne<Product>(id)
  },

  async create(data: {
    name: string
    sku: string
    description?: string
    category: string
    unit_price: number
  }): Promise<Product> {
    return await pb.collection('products').create<Product>(data)
  },

  async update(id: string, data: Partial<Product>): Promise<Product> {
    return await pb.collection('products').update<Product>(id, data)
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('products').delete(id)
  },
}
