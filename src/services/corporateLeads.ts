import pb from '@/lib/pocketbase/client'
import type { CorporateLead, CorporateLeadProfile, CorporateLeadStatus } from '@/types/inventory'

export interface CreateCorporateLeadInput {
  company: string
  contact_name: string
  email: string
  phone: string
  profile: CorporateLeadProfile
  interest?: string
  quantity?: string
  message?: string
  status?: CorporateLeadStatus
}

export interface UpdateCorporateLeadInput {
  status?: CorporateLeadStatus
  company?: string
  contact_name?: string
  email?: string
  phone?: string
  profile?: CorporateLeadProfile
  interest?: string
  quantity?: string
  message?: string
}

export const corporateLeadsService = {
  /**
   * Envia uma cotação corporativa (acesso público)
   */
  async submitLead(data: CreateCorporateLeadInput): Promise<CorporateLead> {
    return await pb.collection('corporate_leads').create<CorporateLead>({
      ...data,
      status: data.status || 'novo',
    })
  },

  /**
   * Lista todos os leads corporativos (área interna autenticada)
   */
  async getAll(filter?: string): Promise<CorporateLead[]> {
    return await pb.collection('corporate_leads').getFullList<CorporateLead>({
      filter: filter || '',
      sort: '-created',
    })
  },

  /**
   * Atualiza o status do lead (ex: marcar como atendido)
   */
  async updateStatus(id: string, status: CorporateLeadStatus): Promise<CorporateLead> {
    return await pb.collection('corporate_leads').update<CorporateLead>(id, {
      status,
    })
  },

  /**
   * Exclui um lead corporativo
   */
  async delete(id: string): Promise<boolean> {
    return await pb.collection('corporate_leads').delete(id)
  },
}
