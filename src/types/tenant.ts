import type { RecordModel } from 'pocketbase'
import type { AppModuleId } from './modules'

export type TenantStatus = 'ativo' | 'inativo' | 'suspenso'

export interface Tenant extends RecordModel {
  name: string
  slug: string
  status: TenantStatus
  plan?: string
  commercial_notes?: string
  modules: AppModuleId[]
}

export interface CreateTenantInput {
  name: string
  slug: string
  status?: TenantStatus
  plan?: string
  commercial_notes?: string
  modules: AppModuleId[]
}

export interface UpdateTenantInput {
  name?: string
  slug?: string
  status?: TenantStatus
  plan?: string
  commercial_notes?: string
  modules?: AppModuleId[]
}

export interface TenantStats {
  tenantId: string
  productsCount: number
  batchesCount: number
  salesCount: number
  usersCount: number
}

export const MASTER_TENANT_ID = 'ambicorpmestre1'
export const MASTER_TENANT_SLUG = 'ambicorp'
