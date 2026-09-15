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

export interface UpdateSaleInput {
  customer_name?: string
  customer_contact?: string
  notes?: string
  status?: 'draft' | 'completed' | 'cancelled'
}

export interface CancelSaleInput {
  sale_id: string
  reason?: string
  force_fiscal?: boolean
}

export interface CancelSaleResult {
  ok: boolean
  sale_id?: string
  status?: string
  restored_items_count?: number
  restored_units_count?: number
  message?: string
  has_authorized_nf?: boolean
  invoices?: Array<{
    id: string
    ref: string
    numero?: string
    status: string
  }>
  error?: string
}

export interface SaleFiscalStatus {
  hasInvoices: boolean
  hasAuthorized: boolean
  invoices: Array<{
    id: string
    ref: string
    numero?: string
    status: string
  }>
}

export const salesService = {
  async getAll(): Promise<Sale[]> {
    return await pb.collection('sales').getFullList<Sale>({
      expand: 'user_id,cancelled_by',
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
   * Finaliza venda mista ou exclusiva por lotes com garantia de atomicidade.
   * Prioriza o hook transacional de backend (POST /backend/v1/sales/create-with-batches)
   * que executa a criação da venda, sale_items, batches e baixa de equipamentos dentro de
   * $app.runInTransaction — se qualquer item falhar, nenhum registro é gravado e o estoque é preservado.
   * Fallback sequencial inteligente apenas se o endpoint de backend estiver inacessível.
   */
  async createSaleWithBatches(input: CreateSaleWithBatchesInput): Promise<Sale> {
    const equipmentItems = input.equipmentItems || []
    const batchLines = input.batchLines || []

    // 1. Pré-validação estrita de estoque somando linhas repetidas do mesmo lote
    const aggregatedDemand: Record<string, number> = {}
    for (const line of batchLines) {
      if (line.quantity > 0) {
        aggregatedDemand[line.purchase_batch_id] =
          (aggregatedDemand[line.purchase_batch_id] || 0) + line.quantity
      }
    }

    for (const [pbId, demandedQty] of Object.entries(aggregatedDemand)) {
      const availableProds = await pb.collection('products').getFullList<any>({
        filter: `purchase_batch_id = "${pbId}" && status = "Disponível"`,
        sort: 'created',
      })

      if (availableProds.length < demandedQty) {
        let batchLabel = pbId
        try {
          const pbRecord = await pb.collection('purchase_batches').getOne<any>(pbId)
          batchLabel = pbRecord.supplier
            ? `${pbRecord.supplier} (NF ${pbRecord.invoice_number || 'S/N'})`
            : pbRecord.id
        } catch {
          // fallback
        }
        throw new Error(
          `Estoque insuficiente no lote "${batchLabel}". Solicitado: ${demandedQty} un, Disponível agora: ${availableProds.length} un. Por favor, revise o pedido.`,
        )
      }
    }

    const userId = input.user_id || pb.authStore.record?.id

    // 2. Chamar o hook atômico no backend PocketBase
    try {
      const response = await pb.send<{ ok: boolean; saleId?: string; error?: string }>(
        '/backend/v1/sales/create-with-batches',
        {
          method: 'POST',
          body: {
            customer_name: input.customer_name,
            customer_contact: input.customer_contact || '',
            notes: input.notes || '',
            user_id: userId,
            equipmentItems,
            batchLines,
          },
        },
      )

      if (response && response.ok && response.saleId) {
        return await pb.collection('sales').getOne<Sale>(response.saleId, {
          expand: 'user_id',
        })
      }

      if (response && response.error) {
        throw new Error(response.error)
      }
    } catch (endpointErr: any) {
      // Se for erro de validação (status 400 ou mensagem de negócio com estoque), repassar diretamente sem fallback
      const status = endpointErr?.status
      const msg = endpointErr?.data?.error || endpointErr?.message || ''
      if (
        status === 400 ||
        (status === 401 && !endpointErr.isAbort) ||
        msg.includes('Estoque insuficiente')
      ) {
        throw new Error(msg || 'Erro na validação do pedido pelo backend.')
      }

      console.warn(
        '[salesService.createSaleWithBatches] Endpoint atômico indisponível ou inacessível. Executando fallback seguro:',
        endpointErr,
      )
    }

    // 3. FALLBACK: Execução sequencial caso o endpoint não responda
    const allocatedByBatch: Array<{
      purchaseBatchId: string
      unitPrice: number
      products: Array<{ id: string; name: string; sku: string; created: string }>
    }> = []

    for (const line of batchLines) {
      if (line.quantity <= 0) continue

      const availableProds = await pb.collection('products').getFullList<any>({
        filter: `purchase_batch_id = "${line.purchase_batch_id}" && status = "Disponível"`,
        sort: 'created',
      })

      if (availableProds.length < line.quantity) {
        throw new Error(
          `Estoque insuficiente no lote. Solicitado: ${line.quantity} un, Disponível: ${availableProds.length} un.`,
        )
      }

      const chosen = availableProds.slice(0, line.quantity)
      allocatedByBatch.push({
        purchaseBatchId: line.purchase_batch_id,
        unitPrice: line.unit_price,
        products: chosen,
      })
    }

    const equipmentTotal = equipmentItems.reduce(
      (sum, item) => sum + item.quantity * item.unit_price,
      0,
    )
    const batchesTotal = allocatedByBatch.reduce(
      (sum, group) => sum + group.products.length * group.unitPrice,
      0,
    )
    const totalAmount = equipmentTotal + batchesTotal

    const sale = await pb.collection('sales').create<Sale>({
      customer_name: input.customer_name,
      customer_contact: input.customer_contact || '',
      notes: input.notes || '',
      total_amount: totalAmount,
      status: 'completed',
      user_id: userId,
    })

    const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 19)

    for (const item of equipmentItems) {
      await pb.collection('sale_items').create({
        sale_id: sale.id,
        product_id: item.product_id,
        batch_id: item.batch_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.quantity * item.unit_price,
      })

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

    for (const group of allocatedByBatch) {
      for (const prod of group.products) {
        let targetBatchId = ''
        const existingBatches = await pb.collection('batches').getFullList<any>({
          filter: `product_id = "${prod.id}"`,
          sort: '-created',
        })

        if (existingBatches.length > 0) {
          targetBatchId = existingBatches[0].id
        } else {
          const newBatch = await pb.collection('batches').create<any>({
            product_id: prod.id,
            batch_number: `LOTE-${prod.sku || prod.id.slice(0, 6)}`,
            quantity: 1,
            location: 'Venda por Lote',
          })
          targetBatchId = newBatch.id
        }

        await pb.collection('sale_items').create({
          sale_id: sale.id,
          product_id: prod.id,
          batch_id: targetBatchId,
          quantity: 1,
          unit_price: group.unitPrice,
          subtotal: group.unitPrice,
        })

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

  /**
   * Atualiza dados cadastrais da venda (cliente, contato, observações, status).
   */
  async updateSale(id: string, data: UpdateSaleInput): Promise<Sale> {
    const payload: Record<string, any> = {}
    if (data.customer_name !== undefined) payload.customer_name = data.customer_name.trim()
    if (data.customer_contact !== undefined) payload.customer_contact = data.customer_contact.trim()
    if (data.notes !== undefined) payload.notes = data.notes.trim()
    if (data.status !== undefined) payload.status = data.status

    return await pb.collection('sales').update<Sale>(id, payload, {
      expand: 'user_id,cancelled_by',
    })
  },

  /**
   * Verifica se há Notas Fiscais vinculadas à venda (e se alguma está autorizada na SEFAZ).
   */
  async checkFiscalStatus(saleId: string): Promise<SaleFiscalStatus> {
    try {
      const records = await pb.collection('nf_invoices').getFullList<any>({
        filter: `sale_id = '${saleId}' && status != 'cancelada' && status != 'rejeitada'`,
        sort: '-created',
      })

      const hasAuthorized = records.some((r) => r.status === 'autorizada')
      return {
        hasInvoices: records.length > 0,
        hasAuthorized,
        invoices: records.map((r) => ({
          id: r.id,
          ref: r.ref,
          numero: r.numero,
          status: r.status,
        })),
      }
    } catch (err) {
      console.warn('[salesService.checkFiscalStatus] Erro ao consultar NFs vinculadas:', err)
      return {
        hasInvoices: false,
        hasAuthorized: false,
        invoices: [],
      }
    }
  },

  /**
   * Cancela a venda de forma atômica, restaurando as quantidades nos lotes
   * e marcando os equipamentos como "Disponível", com histórico e auditoria.
   */
  async cancelSale(input: CancelSaleInput): Promise<CancelSaleResult> {
    const token = pb.authStore.token
    const headers: Record<string, string> = {}
    if (token) {
      headers.Authorization = token
    }

    try {
      const res = await pb.send<CancelSaleResult>('/backend/v1/sales/cancel', {
        method: 'POST',
        headers,
        body: {
          sale_id: input.sale_id,
          reason: input.reason || '',
          force_fiscal: Boolean(input.force_fiscal),
        },
      })
      return res
    } catch (err: any) {
      // Se retornou código 409 (conflito fiscal com NF autorizada)
      if (err?.status === 409 && err?.data) {
        return {
          ok: false,
          has_authorized_nf: true,
          invoices: err.data.invoices || [],
          error: err.data.error || 'Existe Nota Fiscal autorizada vinculada a esta venda.',
        }
      }

      const msg = err?.data?.error || err?.message || 'Falha ao cancelar venda no servidor.'
      throw new Error(msg)
    }
  },
}
