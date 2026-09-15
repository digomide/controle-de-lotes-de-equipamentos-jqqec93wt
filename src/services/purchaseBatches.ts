import pb from '@/lib/pocketbase/client'
import type { PurchaseBatch, Product } from '@/types/inventory'

export interface CreatePurchaseBatchInput {
  supplier: string
  invoice_number?: string
  purchase_date?: string
  total_cost: number
  expected_quantity: number
  status?: 'em_processamento' | 'concluido'
  location?: string
  notes?: string
}

export interface PurchaseBatchSafetyCheck {
  canDelete: boolean
  totalProducts: number
  soldProducts: number
  reservedProducts: number
  availableProducts: number
  pendingActivationProducts: number
  partsCount: number
  reasons: string[]
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

  /**
   * Avalia a segurança da exclusão de um lote de compra antes de executá-la.
   * Se houver equipamentos vendidos ou reservados vinculados ao pedido de compra,
   * a exclusão direta causaria inconsistência contábil e de inventário.
   */
  async checkDeleteSafety(id: string): Promise<PurchaseBatchSafetyCheck> {
    const [products, parts] = await Promise.all([
      pb.collection('products').getFullList<Product>({
        filter: `purchase_batch_id = "${id}"`,
      }),
      pb.collection('equipment_parts').getFullList({
        filter: `purchase_batch_id = "${id}"`,
      }),
    ])

    const soldProducts = products.filter((p) => p.status === 'Vendido').length
    const reservedProducts = products.filter((p) => p.status === 'Reservado').length
    const availableProducts = products.filter((p) => p.status === 'Disponível').length
    const pendingActivationProducts = products.filter(
      (p) => p.status === 'Pendente de ativação',
    ).length

    const reasons: string[] = []
    if (soldProducts > 0) {
      reasons.push(
        `Possui ${soldProducts} equipamento(s) com status "Vendido". A exclusão direta destruiria a rastreabilidade fiscal/contábil da venda.`,
      )
    }
    if (reservedProducts > 0) {
      reasons.push(
        `Possui ${reservedProducts} equipamento(s) com status "Reservado" para compradores.`,
      )
    }

    return {
      canDelete: soldProducts === 0 && reservedProducts === 0,
      totalProducts: products.length,
      soldProducts,
      reservedProducts,
      availableProducts,
      pendingActivationProducts,
      partsCount: parts.length,
      reasons,
    }
  },

  /**
   * Exclusão segura com opção de desvinculação (unlink) ou exclusão em cascata dos equipamentos não vendidos.
   * Por padrão, se 'unlinkProducts' for true, desvincula os produtos e partes definindo purchase_batch_id = null.
   * Se 'deleteProducts' for true, exclui os produtos disponíveis/pendentes que pertenciam ao lote.
   */
  async deleteSafe(
    id: string,
    options?: {
      action?: 'unlink' | 'delete_available'
    },
  ): Promise<{ success: boolean; unlinkedCount: number; deletedProductsCount: number }> {
    const safety = await this.checkDeleteSafety(id)
    if (!safety.canDelete) {
      throw new Error(`Não é possível excluir este pedido de compra: ${safety.reasons.join(' ')}`)
    }

    const mode = options?.action || 'unlink'
    let unlinkedCount = 0
    let deletedProductsCount = 0

    // Buscar equipamentos vinculados
    const products = await pb.collection('products').getFullList<Product>({
      filter: `purchase_batch_id = "${id}"`,
    })

    // Buscar peças vinculadas diretamente ao lote
    const parts = await pb.collection('equipment_parts').getFullList({
      filter: `purchase_batch_id = "${id}"`,
    })

    if (mode === 'unlink') {
      // Desvincula todos os produtos
      for (const prod of products) {
        await pb
          .collection('products')
          .update(prod.id, {
            purchase_batch_id: null,
          })
          .catch(() => {})
        unlinkedCount++
      }
      // Desvincula peças do lote
      for (const part of parts) {
        await pb
          .collection('equipment_parts')
          .update(part.id, {
            purchase_batch_id: null,
          })
          .catch(() => {})
      }
    } else if (mode === 'delete_available') {
      // Exclui produtos disponíveis ou pendentes
      for (const prod of products) {
        if (prod.status === 'Disponível' || prod.status === 'Pendente de ativação') {
          // Remover batches físicos
          const bList = await pb
            .collection('batches')
            .getFullList({
              filter: `product_id = "${prod.id}"`,
            })
            .catch(() => [])
          for (const b of bList) {
            await pb
              .collection('batches')
              .delete(b.id)
              .catch(() => {})
          }
          await pb
            .collection('products')
            .delete(prod.id)
            .catch(() => {})
          deletedProductsCount++
        } else {
          // Para outros casos, desvincula
          await pb
            .collection('products')
            .update(prod.id, {
              purchase_batch_id: null,
            })
            .catch(() => {})
          unlinkedCount++
        }
      }
      // Exclui peças órfãs do lote
      for (const part of parts) {
        await pb
          .collection('equipment_parts')
          .delete(part.id)
          .catch(() => {})
      }
    }

    // Por fim, exclui o lote de compra
    await pb.collection('purchase_batches').delete(id)

    return {
      success: true,
      unlinkedCount,
      deletedProductsCount,
    }
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

  async getAvailableProductsByBatchId(batchId: string): Promise<Product[]> {
    return await pb.collection('products').getFullList<Product>({
      filter: `purchase_batch_id = "${batchId}" && status = "Disponível"`,
      sort: 'created',
    })
  },
}
