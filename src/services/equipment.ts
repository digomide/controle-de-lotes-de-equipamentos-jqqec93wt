import pb from '@/lib/pocketbase/client'
import type { EquipmentPart, EquipmentDeliverable, EquipmentPartStatus } from '@/types/inventory'

export const equipmentService = {
  // Parts / Peças
  async getPartsByProduct(productId: string): Promise<EquipmentPart[]> {
    return await pb.collection('equipment_parts').getFullList<EquipmentPart>({
      filter: `product_id = "${productId}"`,
      expand: 'product_id,purchase_batch_id',
      sort: '-created',
    })
  },

  async getPartsByBatch(batchId: string): Promise<EquipmentPart[]> {
    return await pb.collection('equipment_parts').getFullList<EquipmentPart>({
      filter: `purchase_batch_id = "${batchId}"`,
      expand: 'product_id,purchase_batch_id',
      sort: '-created',
    })
  },

  /**
   * Busca todas as peças pertencentes a uma lista de IDs de produtos em lote,
   * em chunks seguros para evitar limite de tamanho da URL ou estouro de conexões N+1.
   */
  async getPartsByProductIds(productIds: string[]): Promise<EquipmentPart[]> {
    if (!productIds || productIds.length === 0) return []

    // Filtra IDs únicos e remove vazios
    const uniqueIds = Array.from(new Set(productIds.filter(Boolean)))
    if (uniqueIds.length === 0) return []

    // Fatiar em blocos de até 50 produtos por query
    const CHUNK_SIZE = 50
    const chunks: string[][] = []
    for (let i = 0; i < uniqueIds.length; i += CHUNK_SIZE) {
      chunks.push(uniqueIds.slice(i, i + CHUNK_SIZE))
    }

    const results = await Promise.all(
      chunks.map((chunk) => {
        const filterExpr = chunk.map((id) => `product_id = "${id}"`).join(' || ')
        return pb.collection('equipment_parts').getFullList<EquipmentPart>({
          filter: filterExpr,
          expand: 'product_id,purchase_batch_id',
          sort: '-created',
        })
      }),
    )

    return results.flat()
  },

  async getAllParts(tenantId?: string): Promise<EquipmentPart[]> {
    const filter = tenantId ? `tenant_id = '${tenantId}'` : ''
    return await pb.collection('equipment_parts').getFullList<EquipmentPart>({
      filter,
      expand: 'product_id,purchase_batch_id',
      sort: '-created',
    })
  },

  async createPart(data: {
    product_id?: string | null
    purchase_batch_id?: string | null
    name: string
    cost?: number
    quantity?: number
    status: EquipmentPartStatus
    notes?: string
    supplier?: string
    purchase_date?: string
    tenant_id?: string
  }): Promise<EquipmentPart> {
    return await pb.collection('equipment_parts').create<EquipmentPart>(data)
  },

  async updatePart(id: string, data: Partial<EquipmentPart>): Promise<EquipmentPart> {
    return await pb.collection('equipment_parts').update<EquipmentPart>(id, data)
  },

  async deletePart(id: string): Promise<boolean> {
    return await pb.collection('equipment_parts').delete(id)
  },

  // Deliverables / Pendências de Entrega
  async getDeliverablesByProduct(productId: string): Promise<EquipmentDeliverable[]> {
    return await pb.collection('equipment_deliverables').getFullList<EquipmentDeliverable>({
      filter: `product_id = "${productId}"`,
      sort: '-created',
    })
  },

  async createDeliverable(data: {
    product_id: string
    item_name: string
    status: 'Pendente' | 'Resolvido'
    notes?: string
  }): Promise<EquipmentDeliverable> {
    return await pb.collection('equipment_deliverables').create<EquipmentDeliverable>(data)
  },

  async updateDeliverable(
    id: string,
    data: Partial<EquipmentDeliverable>,
  ): Promise<EquipmentDeliverable> {
    return await pb.collection('equipment_deliverables').update<EquipmentDeliverable>(id, data)
  },

  async deleteDeliverable(id: string): Promise<boolean> {
    return await pb.collection('equipment_deliverables').delete(id)
  },
}
