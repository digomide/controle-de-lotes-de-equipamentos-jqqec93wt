import pb from '@/lib/pocketbase/client'
import type {
  MLCustomer,
  CreateMLCustomerInput,
  UpdateMLCustomerInput,
  CustomerNoteEntry,
} from '@/types/customers'
import type { MLOrder } from '@/services/mlOrdersService'

export interface GetCustomersFilter {
  search?: string
  origin?: string
  onlyRecurring?: boolean
  onlyFollowUpTodayOrOverdue?: boolean
  page?: number
  perPage?: number
}

export const mlCustomersService = {
  /**
   * Lista os clientes com filtros avançados de busca, origem e pós-venda
   */
  async getCustomers(
    options?: GetCustomersFilter,
  ): Promise<{ items: MLCustomer[]; totalItems: number }> {
    const page = options?.page || 1
    const perPage = options?.perPage || 100

    const filters: string[] = []

    if (options?.origin && options.origin !== 'all') {
      filters.push(`origin = "${options.origin}"`)
    }

    if (options?.search?.trim()) {
      const q = options.search.trim().replace(/["\\]/g, '')
      filters.push(
        `(name ~ "${q}" || nickname ~ "${q}" || phone ~ "${q}" || email ~ "${q}" || buyer_id ~ "${q}")`,
      )
    }

    const filterStr = filters.join(' && ')

    try {
      const res = await pb.collection('ml_customers').getList<MLCustomer>(page, perPage, {
        sort: '-updated,-created',
        filter: filterStr || undefined,
        requestKey: null,
      })
      return {
        items: res.items,
        totalItems: res.totalItems,
      }
    } catch (err) {
      console.error('Erro ao listar ml_customers:', err)
      return { items: [], totalItems: 0 }
    }
  },

  /**
   * Obtém um cliente por ID
   */
  async getCustomerById(id: string): Promise<MLCustomer | null> {
    try {
      return await pb.collection('ml_customers').getOne<MLCustomer>(id, { requestKey: null })
    } catch (err) {
      console.error('Erro ao obter cliente:', err)
      return null
    }
  },

  /**
   * Cria um cliente manualmente
   */
  async createCustomer(input: CreateMLCustomerInput): Promise<MLCustomer> {
    return await pb.collection('ml_customers').create<MLCustomer>({
      ...input,
      tags: input.tags || (input.origin === 'manual' ? ['manual'] : ['ml']),
    })
  },

  /**
   * Atualiza dados cadastrais ou notas de um cliente
   */
  async updateCustomer(id: string, input: UpdateMLCustomerInput): Promise<MLCustomer> {
    return await pb.collection('ml_customers').update<MLCustomer>(id, input)
  },

  /**
   * Adiciona uma anotação com autor e timestamp no histórico do cliente
   */
  async addNote(id: string, noteText: string, authorName?: string): Promise<MLCustomer> {
    const cust = await pb.collection('ml_customers').getOne<MLCustomer>(id)
    const existingHistory = Array.isArray(cust.notes_history) ? [...cust.notes_history] : []
    const newEntry: CustomerNoteEntry = {
      date: new Date().toISOString(),
      author:
        authorName || pb.authStore.record?.name || pb.authStore.model?.name || 'Equipe Ambicorp',
      text: noteText.trim(),
    }
    existingHistory.unshift(newEntry)

    return await pb.collection('ml_customers').update<MLCustomer>(id, {
      notes_history: existingHistory,
      notes: noteText.trim(),
    })
  },

  /**
   * Agenda a data de retorno (pós-venda) em X dias
   */
  async scheduleContactInDays(id: string, days: number): Promise<MLCustomer> {
    const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    return await pb.collection('ml_customers').update<MLCustomer>(id, {
      next_contact_date: date.toISOString(),
    })
  },

  /**
   * Remove a data de retorno (concluído)
   */
  async clearScheduledContact(id: string): Promise<MLCustomer> {
    return await pb.collection('ml_customers').update<MLCustomer>(id, {
      next_contact_date: null,
    })
  },

  /**
   * Busca todas as compras vinculadas a este cliente (por buyer_id ou buyer_nickname) em ml_orders
   */
  async getCustomerOrders(customer: MLCustomer): Promise<MLOrder[]> {
    const filters: string[] = []
    if (customer.buyer_id) {
      filters.push(`buyer_id = "${customer.buyer_id}"`)
    }
    if (customer.nickname) {
      filters.push(`buyer_nickname = "${customer.nickname.replace(/"/g, '\\"')}"`)
    }

    if (filters.length === 0) return []

    const filterStr = filters.join(' || ')

    try {
      const res = await pb.collection('ml_orders').getList<MLOrder>(1, 100, {
        filter: filterStr,
        sort: '-date_created',
        requestKey: null,
      })
      return res.items
    } catch (err) {
      console.error('Erro ao buscar pedidos do cliente:', err)
      return []
    }
  },

  /**
   * Exclui um cliente (admin)
   */
  async deleteCustomer(id: string): Promise<boolean> {
    try {
      await pb.collection('ml_customers').delete(id)
      return true
    } catch (err) {
      console.error('Erro ao excluir cliente:', err)
      return false
    }
  },
}
