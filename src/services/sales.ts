import pb from '@/lib/pocketbase/client'
import type { Sale, SaleItem } from '@/types/inventory'

export interface CreateSaleInput {
  customer_name: string
  customer_contact?: string
  notes?: string
  items: Array<{
    product_id: string
    batch_id: string
    quantity: number
    unit_price: number
  }>
}

export const salesService = {
  async getAll(): Promise<Sale[]> {
    return await pb.collection('sales').getFullList<Sale>({
      expand: 'user_id',
      sort: '-created',
    })
  },

  async getRecent(limit: number = 5): Promise<Sale[]> {
    const res = await pb.collection('sales').getList<Sale>(1, limit, {
      expand: 'user_id',
      sort: '-created',
    })
    return res.items
  },

  async getById(id: string): Promise<Sale> {
    return await pb.collection('sales').getOne<Sale>(id, {
      expand: 'user_id',
    })
  },

  async getSaleItems(saleId: string): Promise<SaleItem[]> {
    return await pb.collection('sale_items').getFullList<SaleItem>({
      filter: `sale_id = "${saleId}"`,
      expand: 'product_id,batch_id',
      sort: 'created',
    })
  },

  async createSale(input: CreateSaleInput): Promise<Sale> {
    const totalAmount = input.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0)
    const userId = pb.authStore.record?.id

    // 1. Create Sale record
    const sale = await pb.collection('sales').create<Sale>({
      customer_name: input.customer_name,
      customer_contact: input.customer_contact || '',
      notes: input.notes || '',
      total_amount: totalAmount,
      status: 'completed',
      user_id: userId,
    })

    // 2. Create Sale Items (backend hook will automatically decrease stock in batches)
    for (const item of input.items) {
      await pb.collection('sale_items').create({
        sale_id: sale.id,
        product_id: item.product_id,
        batch_id: item.batch_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.quantity * item.unit_price,
      })
    }

    return sale
  },

  async updateStatus(id: string, status: 'draft' | 'completed' | 'cancelled'): Promise<Sale> {
    return await pb.collection('sales').update<Sale>(id, { status })
  },
}
