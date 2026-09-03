import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2 } from 'lucide-react'

export const ProtectedRoute: React.FC<{ children: React.ReactNode; requireAdmin?: boolean }> = ({
  children,
  requireAdmin = false,
}) => {
  const { user, isLoading, isAdmin } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-slate-800" />
          <p className="text-sm font-medium text-slate-600">Carregando sessão...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (requireAdmin && !isAdmin) {
    return (
      <div className="p-8 max-w-lg mx-auto mt-12 bg-white rounded-xl shadow border border-slate-200 text-center">
        <div className="text-rose-500 font-bold text-lg mb-2">Acesso Restrito</div>
        <p className="text-sm text-slate-600 mb-4">
          Esta seção exige privilégios de administrador para realizar ajustes manuais de estoque ou
          configurações sensíveis.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
