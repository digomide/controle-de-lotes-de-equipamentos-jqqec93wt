import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2 } from 'lucide-react'

import { ShieldAlert, ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import type { AppModuleId } from '@/types/modules'
import { getModuleIdByPath, APP_MODULES } from '@/types/modules'

export const ProtectedRoute: React.FC<{
  children: React.ReactNode
  requireAdmin?: boolean
  requiredModule?: AppModuleId
}> = ({ children, requireAdmin = false, requiredModule }) => {
  const { user, isLoading, isAdmin, hasModule } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-slate-800" />
          <p className="text-sm font-medium text-slate-600">Carregando permissões de acesso...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Se requer admin
  if (requireAdmin && !isAdmin) {
    return (
      <div className="p-8 max-w-md mx-auto mt-16 bg-white rounded-2xl shadow-sm border border-slate-200 text-center">
        <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Acesso Restrito</h2>
        <p className="text-xs text-slate-600 mb-6 leading-relaxed">
          Esta seção exige privilégios de Administrador. Seu usuário não possui autorização para
          acessar esta área administrativa.
        </p>
        <Link to="/">
          <Button variant="outline" size="sm" className="text-xs gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar ao Início
          </Button>
        </Link>
      </div>
    )
  }

  // Determinar qual módulo é exigido (passado explicitamente ou deduzido pelo path)
  const targetModule = requiredModule || getModuleIdByPath(location.pathname)

  if (targetModule && !isAdmin && !hasModule(targetModule)) {
    const modDef = APP_MODULES.find((m) => m.id === targetModule)
    const moduleLabel = modDef ? modDef.label : targetModule

    return (
      <div className="p-8 max-w-md mx-auto mt-16 bg-white rounded-2xl shadow-sm border border-slate-200 text-center">
        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Acesso Restrito ao Módulo</h2>
        <p className="text-xs text-slate-600 mb-2 leading-relaxed">
          Você não possui permissão para acessar o módulo <strong>{moduleLabel}</strong>.
        </p>
        <p className="text-[11px] text-slate-400 mb-6">
          Caso necessite deste acesso, solicite a um administrador para liberá-lo no painel de
          Usuários & Acessos.
        </p>
        <Link to="/">
          <Button variant="outline" size="sm" className="text-xs gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar ao Início
          </Button>
        </Link>
      </div>
    )
  }

  return <>{children}</>
}
