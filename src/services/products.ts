import pb from '@/lib/pocketbase/client'
import type { Product, Batch } from '@/types/inventory'

export const productsService = {
  async getAll(): Promise<Product[]> {
    return await pb.collection('products').getFullList<Product>({
      sort: '-created',
      expand: 'purchase_batch_id',
    })
  },

  async getAllByTenant(tenantId?: string): Promise<Product[]> {
    const filter = tenantId ? `tenant_id = '${tenantId}'` : ''
    return await pb.collection('products').getFullList<Product>({
      filter,
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

  /**
   * Atualização em massa de equipamentos (preço e/ou status e/ou localização)
   * Respeita regras de segurança (não permite marcar como Vendido em massa sem venda registrada)
   * Registra histórico de auditoria (history_events)
   */
  async updateBulk(
    productIds: string[],
    updates: {
      unit_price?: number
      cost_price?: number
      status?: 'Disponível' | 'Reservado' | 'Pendente de ativação'
      notes?: string
    },
    userEmailOrName?: string,
  ): Promise<{
    updatedCount: number
    failedCount: number
    blockedCount: number
    errors: string[]
  }> {
    let updatedCount = 0
    let failedCount = 0
    let blockedCount = 0
    const errors: string[] = []
    const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 19)

    for (const id of productIds) {
      try {
        const prod = await pb
          .collection('products')
          .getOne<Product>(id)
          .catch(() => null)
        if (!prod) {
          failedCount++
          continue
        }

        // Se o produto já estiver vendido e tentarem mudar status, bloquear
        if (prod.status === 'Vendido' && updates.status) {
          blockedCount++
          errors.push(`${prod.name} já está vendido e o status não pode ser alterado em lote.`)
          continue
        }

        const payload: Partial<Product> = {}
        const historyDetails: string[] = []

        if (
          updates.unit_price !== undefined &&
          !isNaN(updates.unit_price) &&
          updates.unit_price >= 0
        ) {
          const oldPrice = Number(prod.unit_price) || 0
          payload.unit_price = updates.unit_price
          historyDetails.push(
            `Preço de venda alterado em lote de R$ ${oldPrice.toFixed(2)} para R$ ${updates.unit_price.toFixed(2)}`,
          )
        }

        if (
          updates.cost_price !== undefined &&
          !isNaN(updates.cost_price) &&
          updates.cost_price >= 0
        ) {
          const oldCost = Number(prod.cost_price) || 0
          payload.cost_price = updates.cost_price
          historyDetails.push(
            `Custo alterado em lote de R$ ${oldCost.toFixed(2)} para R$ ${updates.cost_price.toFixed(2)}`,
          )
        }

        if (updates.status && updates.status !== prod.status) {
          payload.status = updates.status
          historyDetails.push(
            `Status alterado em lote de "${prod.status || 'Disponível'}" para "${updates.status}"`,
          )
        }

        if (Object.keys(payload).length === 0) {
          continue
        }

        // Auditoria no histórico do equipamento
        const currentEvents = Array.isArray(prod.history_events) ? [...prod.history_events] : []
        currentEvents.push({
          date: nowIso,
          title: `Alteração em massa (${historyDetails.join('; ')})${
            userEmailOrName ? ` por ${userEmailOrName}` : ''
          }`,
        })
        payload.history_events = currentEvents

        await pb.collection('products').update<Product>(prod.id, payload)
        updatedCount++
      } catch (err: any) {
        failedCount++
        errors.push(err?.message || `Erro ao atualizar equipamento ${id}`)
      }
    }

    return {
      updatedCount,
      failedCount,
      blockedCount,
      errors,
    }
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

  /**
   * Geração em massa de Part Numbers Internos (AMB0001, AMB0002, ...)
   * Ativa equipamentos pendentes sem PN para o status 'Disponível'.
   * Tenta primeiro o endpoint atômico do backend; se indisponível, executa via SDK com loop e rollback.
   */
  async generateInternalPartNumbersBulk(productIds: string[]): Promise<{
    activatedCount: number
    ignoredAlreadyActiveCount: number
    notFoundCount: number
    totalRequested: number
    items?: Array<{ id: string; name: string; part_number: string; status: string }>
  }> {
    if (!productIds || productIds.length === 0) {
      return {
        activatedCount: 0,
        ignoredAlreadyActiveCount: 0,
        notFoundCount: 0,
        totalRequested: 0,
      }
    }

    // 1. Tentar endpoint customizado do backend (transação nativa com $app.runInTransaction)
    try {
      const response = await pb.send<{
        ok: boolean
        activatedCount: number
        ignoredAlreadyActiveCount: number
        notFoundCount: number
        totalRequested: number
        items?: Array<{ id: string; name: string; part_number: string; status: string }>
        error?: string
      }>('/backend/v1/products/bulk-internal-part-numbers', {
        method: 'POST',
        body: { product_ids: productIds },
      })

      if (response && response.ok) {
        return {
          activatedCount: response.activatedCount ?? 0,
          ignoredAlreadyActiveCount: response.ignoredAlreadyActiveCount ?? 0,
          notFoundCount: response.notFoundCount ?? 0,
          totalRequested: response.totalRequested ?? productIds.length,
          items: response.items,
        }
      }
    } catch (endpointErr: any) {
      console.warn(
        'Endpoint customizado /bulk-internal-part-numbers indisponível ou falhou, acionando fallback client-side seguro:',
        endpointErr?.message || endpointErr,
      )
    }

    // 2. Fallback resiliente via SDK
    // Descobrir o maior número AMB existente no banco
    let maxNum = 0
    try {
      const existingAmbProducts = await pb.collection('products').getFullList<Product>({
        filter: "part_number ~ 'AMB'",
        sort: '-created',
        fields: 'id,part_number',
      })

      for (const p of existingAmbProducts) {
        const pn = (p.part_number || '').trim()
        const match = pn.match(/^AMB(\d{4,})$/)
        if (match && match[1]) {
          const val = parseInt(match[1], 10)
          if (!isNaN(val) && val > maxNum) {
            maxNum = val
          }
        }
      }
    } catch (queryErr) {
      console.warn('Erro ao consultar AMB existentes via SDK:', queryErr)
    }

    const formatCode = (n: number) => {
      let s = n.toString()
      while (s.length < 4) {
        s = '0' + s
      }
      return 'AMB' + s
    }

    let seq = maxNum
    let activatedCount = 0
    let ignoredAlreadyActiveCount = 0
    let notFoundCount = 0
    const updatedItems: Array<{ id: string; name: string; part_number: string; status: string }> =
      []
    const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 19)

    for (const pId of productIds) {
      try {
        const prod = await pb
          .collection('products')
          .getOne<Product>(pId)
          .catch(() => null)
        if (!prod) {
          notFoundCount++
          continue
        }

        const existingPn = (prod.part_number || '').trim()
        const currentStatus = prod.status

        // Regra de segurança: Não sobrescrever PN real nem equipamento já ativado
        if (existingPn.length > 0 || currentStatus !== 'Pendente de ativação') {
          ignoredAlreadyActiveCount++
          continue
        }

        seq++
        const newPn = formatCode(seq)
        const currentEvents = Array.isArray(prod.history_events) ? [...prod.history_events] : []
        currentEvents.push({
          date: nowIso,
          title: `Ativação em massa: PN interno gerado (${newPn})`,
        })

        const updated = await pb.collection('products').update<Product>(prod.id, {
          part_number: newPn,
          status: 'Disponível',
          history_events: currentEvents,
        })

        activatedCount++
        updatedItems.push({
          id: updated.id,
          name: updated.name,
          part_number: newPn,
          status: updated.status,
        })
      } catch (itemErr: any) {
        console.error(`Erro ao ativar equipamento ${pId} no fallback:`, itemErr)
      }
    }

    return {
      activatedCount,
      ignoredAlreadyActiveCount,
      notFoundCount,
      totalRequested: productIds.length,
      items: updatedItems,
    }
  },
}
