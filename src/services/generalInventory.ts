import pb from '@/lib/pocketbase/client'
import type {
  GeneralInventoryItem,
  GeneralInventoryMovement,
  GeneralInventoryMovementType,
} from '@/types/generalInventory'

export interface CreateGeneralInventoryItemInput {
  description: string
  category: string
  quantity?: number
  cost_price?: number
  suggested_price?: number
  min_stock?: number
  location?: string
  notes?: string
}

export interface UpdateGeneralInventoryItemInput {
  description?: string
  category?: string
  quantity?: number
  cost_price?: number
  suggested_price?: number
  min_stock?: number
  location?: string
  notes?: string
}

export interface RegisterMovementInput {
  item_id: string
  type: GeneralInventoryMovementType
  quantity: number // positive quantity for entrada/saida/ajuste
  unit_cost?: number
  reason?: string
  observation?: string
  physical_count?: number // only for type === 'ajuste'
}

export const generalInventoryService = {
  async getAllItems(): Promise<GeneralInventoryItem[]> {
    try {
      return await pb.collection('general_inventory_items').getFullList<GeneralInventoryItem>({
        sort: '-created',
      })
    } catch (err: any) {
      console.warn(
        '[generalInventoryService] Erro ao listar com sort -created, tentando fallback por -id:',
        err,
      )
      return await pb.collection('general_inventory_items').getFullList<GeneralInventoryItem>({
        sort: '-id',
      })
    }
  },

  async getItemById(id: string): Promise<GeneralInventoryItem> {
    return await pb.collection('general_inventory_items').getOne<GeneralInventoryItem>(id)
  },

  async createItem(input: CreateGeneralInventoryItemInput): Promise<GeneralInventoryItem> {
    const initialQty = Math.max(0, Number(input.quantity) || 0)
    const costPrice = Math.max(0, Number(input.cost_price) || 0)
    const suggestedPrice = Math.max(0, Number(input.suggested_price) || 0)
    const minStock = Math.max(0, Number(input.min_stock) || 0)

    const item = await pb.collection('general_inventory_items').create<GeneralInventoryItem>({
      description: input.description.trim(),
      category: input.category.trim(),
      quantity: initialQty,
      cost_price: costPrice,
      suggested_price: suggestedPrice,
      min_stock: minStock,
      location: (input.location || '').trim(),
      notes: (input.notes || '').trim(),
    })

    // Se houver saldo inicial maior que 0, registra a movimentação de entrada inicial
    if (initialQty > 0) {
      try {
        const userId = pb.authStore.record?.id
        await pb.collection('general_inventory_movements').create({
          item_id: item.id,
          type: 'entrada',
          quantity: initialQty,
          quantity_before: 0,
          quantity_after: initialQty,
          unit_cost: costPrice,
          reason: 'Cadastro inicial de estoque',
          observation: 'Saldo inicial lançado no cadastro do item',
          user_id: userId,
        })
      } catch (err) {
        console.error('Erro ao registrar movimentação inicial:', err)
      }
    }

    return item
  },

  async updateItem(
    id: string,
    input: UpdateGeneralInventoryItemInput,
  ): Promise<GeneralInventoryItem> {
    const payload: Partial<GeneralInventoryItem> = {}
    if (input.description !== undefined) payload.description = input.description.trim()
    if (input.category !== undefined) payload.category = input.category.trim()
    if (input.quantity !== undefined) payload.quantity = Math.max(0, Number(input.quantity))
    if (input.cost_price !== undefined) payload.cost_price = Math.max(0, Number(input.cost_price))
    if (input.suggested_price !== undefined)
      payload.suggested_price = Math.max(0, Number(input.suggested_price))
    if (input.min_stock !== undefined) payload.min_stock = Math.max(0, Number(input.min_stock))
    if (input.location !== undefined) payload.location = input.location.trim()
    if (input.notes !== undefined) payload.notes = input.notes.trim()

    return await pb.collection('general_inventory_items').update<GeneralInventoryItem>(id, payload)
  },

  async deleteItem(id: string): Promise<boolean> {
    return await pb.collection('general_inventory_items').delete(id)
  },

  async getMovementsByItem(itemId: string): Promise<GeneralInventoryMovement[]> {
    try {
      return await pb
        .collection('general_inventory_movements')
        .getFullList<GeneralInventoryMovement>({
          filter: `item_id = "${itemId}"`,
          sort: '-created',
          expand: 'item_id,user_id',
        })
    } catch (err: any) {
      console.warn(
        '[generalInventoryService] Erro ao buscar movimentações com sort -created, fallback por -id:',
        err,
      )
      return await pb
        .collection('general_inventory_movements')
        .getFullList<GeneralInventoryMovement>({
          filter: `item_id = "${itemId}"`,
          sort: '-id',
          expand: 'item_id,user_id',
        })
    }
  },

  async getAllMovements(limit = 100): Promise<GeneralInventoryMovement[]> {
    try {
      return await pb
        .collection('general_inventory_movements')
        .getList<GeneralInventoryMovement>(1, limit, {
          sort: '-created',
          expand: 'item_id,user_id',
        })
        .then((res) => res.items)
    } catch (err: any) {
      console.warn(
        '[generalInventoryService] Erro ao buscar todas movimentações com sort -created, fallback por -id:',
        err,
      )
      return await pb
        .collection('general_inventory_movements')
        .getList<GeneralInventoryMovement>(1, limit, {
          sort: '-id',
          expand: 'item_id,user_id',
        })
        .then((res) => res.items)
    }
  },

  /**
   * Registra movimentação (entrada, saída ou ajuste) e atualiza o saldo do item de forma consistente.
   * Valida saídas maiores que o saldo em estoque.
   */
  async registerMovement(input: RegisterMovementInput): Promise<GeneralInventoryMovement> {
    const item = await pb
      .collection('general_inventory_items')
      .getOne<GeneralInventoryItem>(input.item_id)
    const currentQty = Number(item.quantity) || 0
    const userId = pb.authStore.record?.id

    let newQty = currentQty
    let movementQty = Math.max(0, Number(input.quantity) || 0)
    let unitCost = input.unit_cost !== undefined ? Number(input.unit_cost) : item.cost_price

    if (input.type === 'entrada') {
      if (movementQty <= 0) {
        throw new Error('A quantidade de entrada deve ser maior que zero.')
      }
      newQty = currentQty + movementQty
      // Se informou novo custo unitário, pode opcionalmente atualizar custo do item
      if (unitCost > 0) {
        await pb.collection('general_inventory_items').update(item.id, {
          quantity: newQty,
          cost_price: unitCost,
        })
      } else {
        await pb.collection('general_inventory_items').update(item.id, {
          quantity: newQty,
        })
      }
    } else if (input.type === 'saida') {
      if (movementQty <= 0) {
        throw new Error('A quantidade de saída deve ser maior que zero.')
      }
      if (movementQty > currentQty) {
        throw new Error(
          `Saldo insuficiente em estoque! Estoque atual: ${currentQty} un. Tentativa de saída: ${movementQty} un.`,
        )
      }
      newQty = currentQty - movementQty
      await pb.collection('general_inventory_items').update(item.id, {
        quantity: newQty,
      })
    } else if (input.type === 'ajuste') {
      const counted =
        input.physical_count !== undefined ? Number(input.physical_count) : movementQty
      if (counted < 0) {
        throw new Error('A contagem física não pode ser negativa.')
      }
      movementQty = Math.abs(counted - currentQty)
      newQty = counted
      await pb.collection('general_inventory_items').update(item.id, {
        quantity: newQty,
      })
    }

    const movement = await pb
      .collection('general_inventory_movements')
      .create<GeneralInventoryMovement>(
        {
          item_id: item.id,
          type: input.type,
          quantity: movementQty,
          quantity_before: currentQty,
          quantity_after: newQty,
          unit_cost: unitCost,
          reason: input.reason || '',
          observation: input.observation || '',
          user_id: userId,
        },
        {
          expand: 'item_id,user_id',
        },
      )

    return movement
  },
}
