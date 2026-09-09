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

  async updateStatus(
    id: string,
    status: 'Disponível' | 'Reservado' | 'Vendido' | 'Pendente de ativação',
  ): Promise<Product> {
    return await pb.collection('products').update<Product>(id, { status })
  },

  async reorderPhotos(
    id: string,
    photos: string[],
    images: string[],
    photoOrder?: Array<{ type: 'photo' | 'image'; value: string }>,
  ): Promise<Product> {
    // 1. Tentar salvar via PATCH padrão no PocketBase atualizando photo_order e images
    // photo_order é um campo JSON que preserva a sequência exata intercalada de fotos locais e URLs externas
    // images é um array de URLs que o PocketBase atualiza sem problemas de diff de arquivos
    const orderPayload = photoOrder || [
      ...photos.map((p) => ({ type: 'photo' as const, value: p })),
      ...images.map((img) => ({ type: 'image' as const, value: img })),
    ]

    try {
      // Primeiro tenta o endpoint customizado se estiver disponível
      const raw = await pb.send<any>(
        `/backend/v1/products/${encodeURIComponent(id)}/reorder-photos`,
        {
          method: 'POST',
          body: {
            photos,
            images,
            photo_order: orderPayload,
          },
        },
      )
      if (raw && raw.id) {
        return raw as Product
      }
    } catch (err: any) {
      // Se der 404 (rota customizada indisponível/não registrada no router do PB), faz o fallback elegante
      // gravando photo_order e images diretamente no registro via coleção padrão
      console.warn(
        'Endpoint customizado de reordenação indisponível, usando fallback photo_order:',
        err?.message || err,
      )
    }

    return await pb.collection('products').update<Product>(id, {
      photo_order: orderPayload,
      images,
    })
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('products').delete(id)
  },

  /**
   * Exclusão em lote com verificação de impedimentos (vendas vinculadas ou status Vendido)
   */
  async deleteBulk(ids: string[]): Promise<{
    deletedCount: number
    failedCount: number
    blockedNames: string[]
    errors: string[]
  }> {
    let deletedCount = 0
    let failedCount = 0
    const blockedNames: string[] = []
    const errors: string[] = []

    for (const id of ids) {
      try {
        // Verificar registro atual para conferir se está vendido ou se tem vínculos
        const prod = await pb
          .collection('products')
          .getOne<Product>(id)
          .catch(() => null)
        if (!prod) {
          // Já não existe
          continue
        }

        // Se estiver com status Vendido, impedir exclusão direta para preservar histórico
        if (prod.status === 'Vendido') {
          failedCount++
          blockedNames.push(
            `${prod.name} (${prod.sku || prod.serial_number || 'Sem serial'}) - Status Vendido`,
          )
          continue
        }

        // Verificar se há itens de venda vinculados a este produto
        try {
          const salesLinks = await pb.collection('sale_items').getList(1, 1, {
            filter: `product_id = "${id}"`,
          })
          if (salesLinks.totalItems > 0) {
            failedCount++
            blockedNames.push(
              `${prod.name} (${prod.sku || prod.serial_number || 'Sem serial'}) - Possui venda vinculada`,
            )
            continue
          }
        } catch {
          // Prossegue se der erro ao consultar sale_items
        }

        // Excluir lotes de estoque (batches) vinculados a este equipamento específico para garantir limpeza completa
        try {
          const relatedBatches = await pb.collection('batches').getFullList({
            filter: `product_id = "${id}"`,
          })
          for (const rb of relatedBatches) {
            await pb
              .collection('batches')
              .delete(rb.id)
              .catch(() => {})
          }
        } catch {
          // ignora
        }

        // Excluir peças e entregas vinculadas
        try {
          const parts = await pb.collection('equipment_parts').getFullList({
            filter: `product_id = "${id}"`,
          })
          for (const part of parts) {
            await pb
              .collection('equipment_parts')
              .delete(part.id)
              .catch(() => {})
          }
        } catch {
          // ignora
        }

        try {
          const dels = await pb.collection('equipment_deliverables').getFullList({
            filter: `product_id = "${id}"`,
          })
          for (const d of dels) {
            await pb
              .collection('equipment_deliverables')
              .delete(d.id)
              .catch(() => {})
          }
        } catch {
          // ignora
        }

        await pb.collection('products').delete(id)
        deletedCount++
      } catch (err: any) {
        failedCount++
        errors.push(err?.message || `Erro ao excluir equipamento ${id}`)
      }
    }

    return {
      deletedCount,
      failedCount,
      blockedNames,
      errors,
    }
  },
}
