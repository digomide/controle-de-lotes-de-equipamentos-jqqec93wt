import pb from '@/lib/pocketbase/client'
import type { Sale, SaleItem } from '@/types/inventory'

export interface CreateSaleInput {
  customer_name: string
  customer_contact?: string
  notes?: string
  user_id?: string
  items: Array<{
    product_id: string
    batch_id: string
    quantity: number
    unit_price: number
  }>
}

export interface BatchSaleLineInput {
  purchase_batch_id: string
  quantity: number
  unit_price: number
}

export interface CreateSaleWithBatchesInput {
  customer_name: string
  customer_contact?: string
  notes?: string
  user_id?: string
  equipmentItems?: Array<{
    product_id: string
    batch_id: string
    quantity: number
    unit_price: number
  }>
  batchLines?: BatchSaleLineInput[]
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
    const userId = input.user_id || pb.authStore.record?.id

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

  /**
   * Finaliza venda mista ou exclusiva por lotes.
   * Para cada linha 'por lote', seleciona automaticamente os primeiros N equipamentos disponíveis
   * do lote (ordenados de forma estável por data de entrada `created`), cria/vincula o registro do lote físico
   * e baixa cada equipamento marcando-o como 'Vendido', associando o histórico da venda.
   */
  async createSaleWithBatches(input: CreateSaleWithBatchesInput): Promise<Sale> {
    const equipmentItems = input.equipmentItems || []
    const batchLines = input.batchLines || []

    // 1. Pré-validação de estoque para linhas por lote
    const allocatedByBatch: Array<{
      purchaseBatchId: string
      unitPrice: number
      products: Array<{ id: string; name: string; sku: string; created: string }>
    }> = []

    for (const line of batchLines) {
      if (line.quantity <= 0) continue

      // Buscar equipamentos disponíveis do lote ordenados por created (mais antigos primeiro)
      const availableProds = await pb.collection('products').getFullList<any>({
        filter: `purchase_batch_id = "${line.purchase_batch_id}" && status = "Disponível"`,
        sort: 'created',
      })

      if (availableProds.length < line.quantity) {
        let batchLabel = line.purchase_batch_id
        try {
          const pbRecord = await pb
            .collection('purchase_batches')
            .getOne<any>(line.purchase_batch_id)
          batchLabel = pbRecord.supplier
            ? `${pbRecord.supplier} (NF ${pbRecord.invoice_number || 'S/N'})`
            : pbRecord.id
        } catch {
          // fallback
        }
        throw new Error(
          `Estoque insuficiente no lote "${batchLabel}". Solicitado: ${line.quantity} un, Disponível agora: ${availableProds.length} un. Por favor, revise o pedido.`,
        )
      }

      // Alocar os primeiros N disponíveis
      const chosen = availableProds.slice(0, line.quantity)
      allocatedByBatch.push({
        purchaseBatchId: line.purchase_batch_id,
        unitPrice: line.unit_price,
        products: chosen,
      })
    }

    // 2. Calcular montante total somando itens por equipamento e itens alocados por lote
    const equipmentTotal = equipmentItems.reduce(
      (sum, item) => sum + item.quantity * item.unit_price,
      0,
    )
    const batchesTotal = allocatedByBatch.reduce(
      (sum, group) => sum + group.products.length * group.unitPrice,
      0,
    )
    const totalAmount = equipmentTotal + batchesTotal

    const userId = input.user_id || pb.authStore.record?.id

    // 3. Criar registro principal de Venda (sales)
    const sale = await pb.collection('sales').create<Sale>({
      customer_name: input.customer_name,
      customer_contact: input.customer_contact || '',
      notes: input.notes || '',
      total_amount: totalAmount,
      status: 'completed',
      user_id: userId,
    })

    const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 19)

    // 4. Processar itens diretos por equipamento (fluxo tradicional)
    for (const item of equipmentItems) {
      await pb.collection('sale_items').create({
        sale_id: sale.id,
        product_id: item.product_id,
        batch_id: item.batch_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.quantity * item.unit_price,
      })

      // Marcar equipamento como Vendido e registrar histórico
      try {
        const prod = await pb.collection('products').getOne<any>(item.product_id)
        const currentEvents = Array.isArray(prod.history_events) ? [...prod.history_events] : []
        currentEvents.push({
          date: nowIso,
          title: `Vendido para ${input.customer_name} (Venda #${sale.id.slice(0, 6)})`,
        })
        await pb.collection('products').update(prod.id, {
          status: 'Vendido',
          history_events: currentEvents,
        })
      } catch (pErr) {
        console.warn(`Aviso ao registrar histórico do produto ${item.product_id}:`, pErr)
      }
    }

    // 5. Processar itens das linhas "Por Lote"
    for (const group of allocatedByBatch) {
      for (const prod of group.products) {
        // Encontrar ou garantir registro em 'batches' para o produto
        let targetBatchId = ''
        const existingBatches = await pb.collection('batches').getFullList<any>({
          filter: `product_id = "${prod.id}"`,
          sort: '-created',
        })

        if (existingBatches.length > 0) {
          targetBatchId = existingBatches[0].id
        } else {
          // Criar registro de estoque individual para o equipamento caso ainda não tenha lote em batches
          const newBatch = await pb.collection('batches').create<any>({
            product_id: prod.id,
            batch_number: `LOTE-${prod.sku || prod.id.slice(0, 6)}`,
            quantity: 1,
            location: 'Venda por Lote',
          })
          targetBatchId = newBatch.id
        }

        // Criar sale_item para este equipamento específico
        await pb.collection('sale_items').create({
          sale_id: sale.id,
          product_id: prod.id,
          batch_id: targetBatchId,
          quantity: 1,
          unit_price: group.unitPrice,
          subtotal: group.unitPrice,
        })

        // Atualizar status do produto para 'Vendido' com histórico
        try {
          const freshProd = await pb.collection('products').getOne<any>(prod.id)
          const currentEvents = Array.isArray(freshProd.history_events)
            ? [...freshProd.history_events]
            : []
          currentEvents.push({
            date: nowIso,
            title: `Vendido por Lote para ${input.customer_name} (Venda #${sale.id.slice(0, 6)})`,
          })
          await pb.collection('products').update(prod.id, {
            status: 'Vendido',
            history_events: currentEvents,
          })
        } catch (pErr) {
          console.warn(`Aviso ao atualizar produto ${prod.id} na baixa por lote:`, pErr)
        }
      }
    }

    return sale
  },

  async updateStatus(id: string, status: 'draft' | 'completed' | 'cancelled'): Promise<Sale> {
    return await pb.collection('sales').update<Sale>(id, { status })
  },
}
