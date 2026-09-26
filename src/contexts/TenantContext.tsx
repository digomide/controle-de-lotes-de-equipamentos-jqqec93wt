import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { Tenant } from '@/types/tenant'
import { MASTER_TENANT_ID, MASTER_TENANT_SLUG } from '@/types/tenant'
import { tenantsService } from '@/services/tenantsService'
import { resolveTenantFromHost, TENANT_STORAGE_KEY } from '@/utils/tenantResolver'
import { ALL_MODULE_IDS, type AppModuleId } from '@/types/modules'

interface TenantContextType {
  currentTenant: Tenant | null
  masterTenant: Tenant | null
  allTenants: Tenant[]
  isLoadingTenant: boolean
  isMasterTenant: boolean
  isImpersonating: boolean // super-admin navegando como um tenant específico
  resolvedBySubdomain: boolean
  resolvedSlug: string | null
  activeModules: AppModuleId[]
  hasTenantModule: (moduleId: AppModuleId) => boolean
  setCurrentTenant: (tenant: Tenant | null) => void
  switchTenant: (tenantId: string) => Promise<void>
  refreshTenants: () => Promise<void>
  resetToMaster: () => void
}

const TenantContext = createContext<TenantContextType | undefined>(undefined)

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTenant, setCurrentTenantState] = useState<Tenant | null>(null)
  const [masterTenant, setMasterTenant] = useState<Tenant | null>(null)
  const [allTenants, setAllTenants] = useState<Tenant[]>([])
  const [isLoadingTenant, setIsLoadingTenant] = useState<boolean>(true)
  const [resolvedBySubdomain, setResolvedBySubdomain] = useState<boolean>(false)
  const [resolvedSlug, setResolvedSlug] = useState<string | null>(null)

  const loadInitialTenant = useCallback(async () => {
    setIsLoadingTenant(true)
    try {
      // Recuo Multi-Tenant: Limpa qualquer chave residual de tenant do localStorage
      try {
        localStorage.removeItem(TENANT_STORAGE_KEY)
      } catch {
        /* ignore */
      }

      // 1. Carrega tenant mestre definitivo
      const master = await tenantsService.getMasterTenant()
      setMasterTenant(master)

      // 2. Mantém lista de tenants para compatibilidade com rotas administrativas (sem afetar o contexto ativo)
      let list: Tenant[] = []
      try {
        list = await tenantsService.getAll()
        setAllTenants(list)
      } catch {
        /* intentionally ignored */
      }

      setResolvedBySubdomain(false)
      setResolvedSlug(null)

      // REGRA DE RECUO SINGLE-TENANT: O tenant ativo SEMPRE é o tenant MESTRE da Ambicorp
      setCurrentTenantState(master)
    } catch (err) {
      console.error('[TenantContext] Falha ao resolver tenant mestre:', err)
    } finally {
      setIsLoadingTenant(false)
    }
  }, [])

  useEffect(() => {
    loadInitialTenant()
  }, [loadInitialTenant])

  const refreshTenants = async () => {
    try {
      const list = await tenantsService.getAll()
      setAllTenants(list)
      const master = await tenantsService.getMasterTenant()
      setMasterTenant(master)
      setCurrentTenantState(master)
    } catch (err) {
      console.warn('[TenantContext] Erro ao atualizar lista de tenants:', err)
    }
  }

  // Em modo conta única (recuo multi-tenant), switchTenant e resetToMaster mantêm sempre o mestre ativo
  const switchTenant = async (_tenantId: string) => {
    setIsLoadingTenant(true)
    try {
      try {
        localStorage.removeItem(TENANT_STORAGE_KEY)
      } catch {
        /* ignore */
      }
      if (masterTenant) {
        setCurrentTenantState(masterTenant)
      } else {
        const master = await tenantsService.getMasterTenant()
        setCurrentTenantState(master)
      }
    } finally {
      setIsLoadingTenant(false)
    }
  }

  const resetToMaster = () => {
    try {
      localStorage.removeItem(TENANT_STORAGE_KEY)
    } catch {
      /* ignore */
    }
    if (masterTenant) {
      setCurrentTenantState(masterTenant)
    }
  }

  const setCurrentTenant = (_tenant: Tenant | null) => {
    try {
      localStorage.removeItem(TENANT_STORAGE_KEY)
    } catch {
      /* ignore */
    }
    if (masterTenant) {
      setCurrentTenantState(masterTenant)
    }
  }

  // Sempre verdadeiro em modo single-tenant
  const isMasterTenant = true

  // Sempre falso em modo single-tenant: nunca impersonando
  const isImpersonating = false

  // Todos os módulos canônicos estão liberados para qualquer usuário/tenant
  const activeModules: AppModuleId[] = ALL_MODULE_IDS

  const hasTenantModule = (_moduleId: AppModuleId): boolean => {
    return true
  }

  return (
    <TenantContext.Provider
      value={{
        currentTenant,
        masterTenant,
        allTenants,
        isLoadingTenant,
        isMasterTenant,
        isImpersonating,
        resolvedBySubdomain,
        resolvedSlug,
        activeModules,
        hasTenantModule,
        setCurrentTenant,
        switchTenant,
        refreshTenants,
        resetToMaster,
      }}
    >
      {children}
    </TenantContext.Provider>
  )
}

export const useTenant = () => {
  const context = useContext(TenantContext)
  if (!context) {
    throw new Error('useTenant deve ser usado dentro de um TenantProvider')
  }
  return context
}
