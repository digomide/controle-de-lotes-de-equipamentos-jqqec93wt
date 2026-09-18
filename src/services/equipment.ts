import pb from '@/lib/pocketbase/client'
import type { EquipmentPart, EquipmentDeliverable } from '@/types/inventory'

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

  async getAllParts(tenantId?: string): Promise<EquipmentPart[]> {
    const filter = tenantId ? `tenant_id = '${tenantId}'` : ''
    return await pb.collection('equipment_parts').getFullList<EquipmentPart>({
      filter,
      expand: 'product_id,purchase_batch_id',
      sort: '-created',
    })
  },

  async createPart(data: {
    product_id?: string
    purchase_batch_id?: string
    name: string
    cost?: number
    status: 'Pendente' | 'Trocado' | 'Instalado' | 'Danificado'
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
