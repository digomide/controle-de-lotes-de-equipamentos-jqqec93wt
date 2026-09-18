import pb from '@/lib/pocketbase/client'
import type { Tenant, CreateTenantInput, UpdateTenantInput, TenantStats } from '@/types/tenant'
import { MASTER_TENANT_ID, MASTER_TENANT_SLUG } from '@/types/tenant'
import { ALL_MODULE_IDS } from '@/types/modules'

export const tenantsService = {
  /**
   * Lista todos os tenants cadastrados (para super_admin)
   */
  async getAll(): Promise<Tenant[]> {
    try {
      const records = await pb.collection('tenants').getFullList<Tenant>({
        sort: 'name',
      })
      return records
    } catch (err) {
      console.error('[tenantsService] Erro ao listar tenants:', err)
      return []
    }
  },

  /**
   * Busca tenant pelo ID
   */
  async getById(id: string): Promise<Tenant | null> {
    try {
      return await pb.collection('tenants').getOne<Tenant>(id)
    } catch {
      return null
    }
  },

  /**
   * Busca tenant pelo slug (ex: 'cliente1')
   */
  async getBySlug(slug: string): Promise<Tenant | null> {
    const cleanSlug = (slug || '').trim().toLowerCase()
    if (!cleanSlug) return null
    try {
      const records = await pb.collection('tenants').getList<Tenant>(1, 1, {
        filter: `slug = '${cleanSlug}'`,
      })
      return records.items[0] || null
    } catch {
      return null
    }
  },

  /**
   * Retorna o tenant mestre da Ambicorp com garantia de fallback
   */
  async getMasterTenant(): Promise<Tenant> {
    try {
      const master = await this.getById(MASTER_TENANT_ID)
      if (master) return master
    } catch {
      /* intentionally ignored */
    }

    try {
      const bySlug = await this.getBySlug(MASTER_TENANT_SLUG)
      if (bySlug) return bySlug
    } catch {
      /* intentionally ignored */
    }

    // Fallback estático seguro caso backend esteja em boot
    return {
      id: MASTER_TENANT_ID,
      collectionId: 'tenants',
      collectionName: 'tenants',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      name: 'Ambicorp Mestre',
      slug: MASTER_TENANT_SLUG,
      status: 'ativo',
      plan: 'Enterprise / Dono',
      commercial_notes: 'Conta mestre administradora da Ambicorp',
      modules: ALL_MODULE_IDS,
    } as Tenant
  },

  /**
   * Cria um novo tenant (cliente)
   */
  async create(data: CreateTenantInput): Promise<Tenant> {
    const payload = {
      name: data.name.trim(),
      slug: data.slug.trim().toLowerCase(),
      status: data.status || 'ativo',
      plan: data.plan || '',
      commercial_notes: data.commercial_notes || '',
      modules: data.modules && data.modules.length > 0 ? data.modules : ['dashboard', 'vendas'],
    }
    return await pb.collection('tenants').create<Tenant>(payload)
  },

  /**
   * Atualiza dados e módulos do tenant
   */
  async update(id: string, data: UpdateTenantInput): Promise<Tenant> {
    const payload: Record<string, any> = {}
    if (data.name !== undefined) payload.name = data.name.trim()
    if (data.slug !== undefined) payload.slug = data.slug.trim().toLowerCase()
    if (data.status !== undefined) payload.status = data.status
    if (data.plan !== undefined) payload.plan = data.plan
    if (data.commercial_notes !== undefined) payload.commercial_notes = data.commercial_notes
    if (data.modules !== undefined) payload.modules = data.modules

    return await pb.collection('tenants').update<Tenant>(id, payload)
  },

  /**
   * Exclusão segura de tenant (impede exclusão do tenant mestre)
   */
  async delete(id: string): Promise<boolean> {
    if (id === MASTER_TENANT_ID) {
      throw new Error(
        'O tenant mestre da Ambicorp não pode ser excluído sob nenhuma circunstância.',
      )
    }
    return await pb.collection('tenants').delete(id)
  },

  /**
   * Conta registros vinculados ao tenant (produtos, lotes, vendas, usuários)
   */
  async getTenantStats(tenantId: string): Promise<TenantStats> {
    const stats: TenantStats = {
      tenantId,
      productsCount: 0,
      batchesCount: 0,
      salesCount: 0,
      usersCount: 0,
    }

    try {
      const [prodRes, batchRes, salesRes, usersRes] = await Promise.allSettled([
        pb.collection('products').getList(1, 1, { filter: `tenant_id = '${tenantId}'` }),
        pb.collection('batches').getList(1, 1, { filter: `tenant_id = '${tenantId}'` }),
        pb.collection('sales').getList(1, 1, { filter: `tenant_id = '${tenantId}'` }),
        pb.collection('users').getList(1, 1, { filter: `tenant_id = '${tenantId}'` }),
      ])

      if (prodRes.status === 'fulfilled') stats.productsCount = prodRes.value.totalItems
      if (batchRes.status === 'fulfilled') stats.batchesCount = batchRes.value.totalItems
      if (salesRes.status === 'fulfilled') stats.salesCount = salesRes.value.totalItems
      if (usersRes.status === 'fulfilled') stats.usersCount = usersRes.value.totalItems
    } catch (err) {
      console.warn('[tenantsService] Erro ao calcular estatísticas do tenant:', err)
    }

    return stats
  },
}
