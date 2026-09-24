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
      // 1. Carrega tenant mestre primeiro
      const master = await tenantsService.getMasterTenant()
      setMasterTenant(master)

      // 2. Tenta listar todos os tenants (se permitido)
      let list: Tenant[] = []
      try {
        list = await tenantsService.getAll()
        setAllTenants(list)
      } catch {
        /* intentionally ignored */
      }

      // 3. Resolução por hostname
      const hostRes = resolveTenantFromHost()
      setResolvedBySubdomain(hostRes.isSubdomain)
      setResolvedSlug(hostRes.slug)

      let targetTenant: Tenant | null = null

      if (hostRes.slug && hostRes.slug !== MASTER_TENANT_SLUG) {
        // Buscar tenant correspondente ao slug do subdomínio ou query param
        targetTenant = await tenantsService.getBySlug(hostRes.slug)
      } else if (hostRes.source === 'storage') {
        const storedId = localStorage.getItem(TENANT_STORAGE_KEY)
        if (storedId) {
          targetTenant = await tenantsService.getById(storedId)
        }
      }

      // Se não encontrou ou é o mestre, usa o masterTenant
      if (!targetTenant) {
        targetTenant = master
      }

      setCurrentTenantState(targetTenant)
    } catch (err) {
      console.error('[TenantContext] Falha ao resolver tenant:', err)
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
      if (currentTenant) {
        const updated = list.find((t) => t.id === currentTenant.id)
        if (updated) setCurrentTenantState(updated)
      }
    } catch (err) {
      console.warn('[TenantContext] Erro ao atualizar lista de tenants:', err)
    }
  }

  const switchTenant = async (tenantId: string) => {
    setIsLoadingTenant(true)
    try {
      if (tenantId === MASTER_TENANT_ID || !tenantId) {
        if (masterTenant) {
          setCurrentTenantState(masterTenant)
          localStorage.removeItem(TENANT_STORAGE_KEY)
        }
        return
      }

      let found = allTenants.find((t) => t.id === tenantId)
      if (!found) {
        found = (await tenantsService.getById(tenantId)) || undefined
      }

      if (found) {
        setCurrentTenantState(found)
        localStorage.setItem(TENANT_STORAGE_KEY, found.id)
      }
    } finally {
      setIsLoadingTenant(false)
    }
  }

  const resetToMaster = () => {
    if (masterTenant) {
      setCurrentTenantState(masterTenant)
      localStorage.removeItem(TENANT_STORAGE_KEY)
    }
  }

  const setCurrentTenant = (tenant: Tenant | null) => {
    setCurrentTenantState(tenant)
    if (tenant) {
      localStorage.setItem(TENANT_STORAGE_KEY, tenant.id)
    } else {
      localStorage.removeItem(TENANT_STORAGE_KEY)
    }
  }

  const isMasterTenant =
    !currentTenant ||
    currentTenant.id === MASTER_TENANT_ID ||
    currentTenant.slug === MASTER_TENANT_SLUG

  // Se o currentTenant for diferente do masterTenant, está em modo impersonação/visualização
  const isImpersonating = !isMasterTenant

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
