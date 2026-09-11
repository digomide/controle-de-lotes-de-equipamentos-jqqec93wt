import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/contexts/AuthContext'
import { usersService, type UserWithAccess } from '@/services/users'
import type { User } from '@/types/inventory'
import {
  APP_MODULES,
  type AppModuleId,
  ALL_MODULE_IDS,
  DEFAULT_MEMBER_MODULE_IDS,
} from '@/types/modules'
import {
  Users,
  UserPlus,
  ShieldAlert,
  ShieldCheck,
  Mail,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Search,
  RefreshCw,
  PowerOff,
  Power,
  Loader2,
  UserCheck,
  AlertTriangle,
  Sliders,
  Sparkles,
  Lock,
} from 'lucide-react'

export default function Usuarios() {
  const { user: currentUser, refreshUser } = useAuth()

  const [users, setUsers] = useState<UserWithAccess[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  )

  // Modal Novo Usuário
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<'admin' | 'member'>('member')
  const [newModules, setNewModules] = useState<AppModuleId[]>(DEFAULT_MEMBER_MODULE_IDS)
  const [isCreating, setIsCreating] = useState(false)

  // Modal Reset de Senha (Exibição única da senha provisória)
  const [resetModalData, setResetModalData] = useState<{
    user: UserWithAccess
    temporaryPassword?: string
    isResetting: boolean
  } | null>(null)
  const [copiedPassword, setCopiedPassword] = useState(false)

  // Modal Alterar Papel
  const [roleModalUser, setRoleModalUser] = useState<UserWithAccess | null>(null)
  const [selectedRole, setSelectedRole] = useState<'admin' | 'member'>('member')
  const [isUpdatingRole, setIsUpdatingRole] = useState(false)

  // Modal Editar Permissões / Módulos (Switches individuais por módulo)
  const [accessModalUser, setAccessModalUser] = useState<UserWithAccess | null>(null)
  const [selectedModules, setSelectedModules] = useState<AppModuleId[]>([])
  const [isSavingAccess, setIsSavingAccess] = useState(false)

  // Modal Confirmação Toggle Status (Ativar / Desativar)
  const [statusModalUser, setStatusModalUser] = useState<UserWithAccess | null>(null)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)

  // Carregar lista de usuários com acessos
  const fetchUsers = async () => {
    setIsLoading(true)
    try {
      const list = await usersService.getAllWithAccess()
      setUsers(list)
    } catch (err: any) {
      console.error('[Usuarios] Erro ao carregar usuários:', err)
      setFeedback({
        type: 'error',
        message: 'Não foi possível carregar a lista de usuários: ' + (err.message || err),
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  // Limpar feedback automaticamente após alguns segundos
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => {
        setFeedback(null)
      }, 6000)
      return () => clearTimeout(timer)
    }
  }, [feedback])

  // Ação: Criar Novo Usuário
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEmail || !newEmail.includes('@')) {
      setFeedback({ type: 'error', message: 'Informe um e-mail válido para o novo usuário.' })
      return
    }
    if (!newPassword || newPassword.length < 8) {
      setFeedback({
        type: 'error',
        message: 'A senha provisória deve conter no mínimo 8 caracteres.',
      })
      return
    }

    setIsCreating(true)
    try {
      await usersService.createUser({
        name: newName.trim() || newEmail.split('@')[0],
        email: newEmail.trim().toLowerCase(),
        password: newPassword,
        role: newRole,
        modules: newRole === 'admin' ? ALL_MODULE_IDS : newModules,
      })

      setFeedback({
        type: 'success',
        message: `Usuário ${newEmail} cadastrado com sucesso com ${
          newRole === 'admin'
            ? 'acesso total de Administrador'
            : `${newModules.length} módulo(s) liberado(s)`
        }!`,
      })

      setIsCreateOpen(false)
      setNewName('')
      setNewEmail('')
      setNewPassword('')
      setNewRole('member')
      setNewModules(DEFAULT_MEMBER_MODULE_IDS)
      fetchUsers()
    } catch (err: any) {
      console.error('[Usuarios] Erro ao criar usuário:', err)
      setFeedback({
        type: 'error',
        message: err.message || 'Falha ao cadastrar usuário. Verifique se o e-mail já existe.',
      })
    } finally {
      setIsCreating(false)
    }
  }

  // Ação: Iniciar Edição de Acessos
  const handleOpenAccessModal = (targetUser: UserWithAccess) => {
    const isTargetAdmin =
      targetUser.role === 'admin' ||
      targetUser.email === 'rodrigoifgx@gmail.com' ||
      targetUser.email.toLowerCase().includes('gomide')

    setAccessModalUser(targetUser)
    setSelectedModules(
      isTargetAdmin ? ALL_MODULE_IDS : targetUser.modules || DEFAULT_MEMBER_MODULE_IDS,
    )
  }

  // Ação: Salvar Módulos
  const handleSaveAccess = async () => {
    if (!accessModalUser) return

    setIsSavingAccess(true)
    try {
      await usersService.saveUserModules(accessModalUser.id, selectedModules)

      setFeedback({
        type: 'success',
        message: `Permissões de ${accessModalUser.name || accessModalUser.email} atualizadas com sucesso (${selectedModules.length} módulo(s))!`,
      })

      setAccessModalUser(null)
      fetchUsers()

      // Se for o próprio usuário logado, atualiza sessão
      if (accessModalUser.id === currentUser?.id) {
        refreshUser()
      }
    } catch (err: any) {
      console.error('[Usuarios] Erro ao salvar módulos:', err)
      setFeedback({
        type: 'error',
        message: 'Erro ao salvar módulos: ' + (err.message || err),
      })
    } finally {
      setIsSavingAccess(false)
    }
  }

  const toggleModuleSelection = (moduleId: AppModuleId) => {
    setSelectedModules((prev) =>
      prev.includes(moduleId) ? prev.filter((m) => m !== moduleId) : [...prev, moduleId],
    )
  }

  const toggleNewUserModule = (moduleId: AppModuleId) => {
    setNewModules((prev) =>
      prev.includes(moduleId) ? prev.filter((m) => m !== moduleId) : [...prev, moduleId],
    )
  }

  // Ação: Iniciar Reset de Senha
  const handleOpenResetModal = (targetUser: UserWithAccess) => {
    setCopiedPassword(false)
    setResetModalData({
      user: targetUser,
      temporaryPassword: '',
      isResetting: false,
    })
  }

  // Ação: Executar Reset no Servidor
  const handleExecuteResetPassword = async () => {
    if (!resetModalData) return

    setResetModalData((prev) => (prev ? { ...prev, isResetting: true } : null))
    try {
      const result = await usersService.resetPassword(resetModalData.user.id)
      setResetModalData({
        user: resetModalData.user,
        temporaryPassword: result.temporaryPassword,
        isResetting: false,
      })
      setFeedback({
        type: 'success',
        message: `Senha provisória gerada com sucesso para ${resetModalData.user.email}!`,
      })
    } catch (err: any) {
      console.error('[Usuarios] Erro ao resetar senha:', err)
      setFeedback({
        type: 'error',
        message: 'Erro ao gerar senha provisória: ' + (err.message || err),
      })
      setResetModalData(null)
    }
  }

  // Ação: Copiar Senha Provisória
  const handleCopyPassword = () => {
    if (resetModalData?.temporaryPassword) {
      navigator.clipboard.writeText(resetModalData.temporaryPassword)
      setCopiedPassword(true)
      setTimeout(() => setCopiedPassword(false), 3000)
    }
  }

  // Ação: Alterar Papel (admin <-> member)
  const handleSaveRole = async () => {
    if (!roleModalUser) return

    if (roleModalUser.id === currentUser?.id && selectedRole !== 'admin') {
      setFeedback({
        type: 'error',
        message: 'Proteção de segurança: você não pode remover seu próprio papel de administrador.',
      })
      setRoleModalUser(null)
      return
    }

    setIsUpdatingRole(true)
    try {
      await usersService.updateUser(roleModalUser.id, { role: selectedRole })
      setFeedback({
        type: 'success',
        message: `Papel de ${roleModalUser.name} alterado para ${
          selectedRole === 'admin' ? 'Administrador' : 'Membro'
        }.`,
      })
      setRoleModalUser(null)
      fetchUsers()
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: 'Falha ao atualizar papel: ' + (err.message || err),
      })
    } finally {
      setIsUpdatingRole(false)
    }
  }

  // Ação: Ativar/Desativar Usuário
  const handleToggleStatus = async () => {
    if (!statusModalUser) return

    const newActiveState = statusModalUser.active === false ? true : false

    if (statusModalUser.id === currentUser?.id && !newActiveState) {
      setFeedback({
        type: 'error',
        message:
          'Proteção de segurança: você não pode desativar a sua própria conta de administrador.',
      })
      setStatusModalUser(null)
      return
    }

    setIsUpdatingStatus(true)
    try {
      await usersService.updateUser(statusModalUser.id, { active: newActiveState })
      setFeedback({
        type: 'success',
        message: `Usuário ${statusModalUser.name} ${
          newActiveState ? 'reativado' : 'desativado'
        } com sucesso!`,
      })
      setStatusModalUser(null)
      fetchUsers()
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: 'Falha ao alterar status da conta: ' + (err.message || err),
      })
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  // Filtragem local por busca
  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return true
    return (
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.role || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-slate-700" />
            Usuários & Acessos
          </h2>
          <p className="text-sm text-slate-500">
            Controle de acessos granulares por módulo individual (chaves liga/desliga), criação de
            operadores, senhas e imunidade de administradores.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchUsers}
            disabled={isLoading}
            className="text-xs h-9 text-slate-600 gap-1.5"
            title="Atualizar lista"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Recarregar
          </Button>

          <Button
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="bg-orange-600 hover:bg-orange-700 text-white text-xs h-9 font-medium shadow-xs gap-1.5"
          >
            <UserPlus className="w-4 h-4" />
            Novo Usuário
          </Button>
        </div>
      </div>

      {/* Alerta / Feedback Inline */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 shadow-xs ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            )}
            <span className="font-medium">{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 text-xs underline"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Cartão de Resumo e Filtro */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">
                Usuários e Permissões Cadastrados ({users.length})
              </CardTitle>
              <CardDescription className="text-xs">
                Controle individual por módulo: configure exatamente o que cada usuário enxerga no
                sidebar e pode acessar no sistema.
              </CardDescription>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <Input
                type="search"
                placeholder="Filtrar por nome ou e-mail..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-xs h-9 bg-slate-50 border-slate-200"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-400" />
              <p className="text-xs">Carregando usuários e permissões do sistema...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-medium text-slate-700">Nenhum usuário encontrado</p>
              <p className="text-xs text-slate-400 mt-1">
                Tente ajustar os termos da busca ou cadastre um novo usuário.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-medium">
                    <th className="py-3 px-4">Usuário</th>
                    <th className="py-3 px-4">E-mail</th>
                    <th className="py-3 px-4">Papel</th>
                    <th className="py-3 px-4">Módulos Liberados</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((u) => {
                    const isSelf = u.id === currentUser?.id
                    const isAdmin =
                      u.role === 'admin' ||
                      u.email === 'rodrigoifgx@gmail.com' ||
                      u.email.toLowerCase().includes('gomide')
                    const isActive = u.active !== false
                    const modulesCount = isAdmin ? APP_MODULES.length : u.modules?.length || 0

                    return (
                      <tr
                        key={u.id}
                        className={`hover:bg-slate-50/60 transition-colors ${
                          !isActive ? 'bg-slate-50/50 opacity-75' : ''
                        }`}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs uppercase flex-shrink-0">
                              {u.name?.slice(0, 2) || 'US'}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                                <span>{u.name || 'Sem nome'}</span>
                                {isSelf && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] h-4 px-1.5 bg-blue-50 text-blue-700 border-blue-200 font-normal"
                                  >
                                    Você
                                  </Badge>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-400 font-mono">
                                ID: {u.id}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 text-slate-700">
                            <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span>{u.email}</span>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <Badge
                            variant="outline"
                            className={
                              isAdmin
                                ? 'bg-amber-100 text-amber-900 border-amber-300 font-semibold gap-1'
                                : 'bg-slate-100 text-slate-800 border-slate-300 font-medium gap-1'
                            }
                          >
                            {isAdmin ? (
                              <ShieldAlert className="w-3 h-3 text-amber-700" />
                            ) : (
                              <UserCheck className="w-3 h-3 text-slate-600" />
                            )}
                            {isAdmin ? 'Administrador' : 'Membro'}
                          </Badge>
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {isAdmin ? (
                              <Badge className="bg-amber-500/15 text-amber-800 border-amber-300/80 text-[11px] font-medium gap-1 hover:bg-amber-500/20">
                                <Sparkles className="w-3 h-3 text-amber-600" />
                                Todos os Módulos (Admin Imune)
                              </Badge>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <Badge
                                  variant="outline"
                                  className="bg-blue-50 text-blue-800 border-blue-200 font-semibold text-[11px]"
                                >
                                  {modulesCount} de {APP_MODULES.length} módulos
                                </Badge>
                                {modulesCount === 1 && (
                                  <span className="text-[10px] text-slate-500 italic">
                                    (Acesso dedicado)
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          {isActive ? (
                            <Badge
                              variant="outline"
                              className="bg-emerald-50 text-emerald-800 border-emerald-200 font-medium gap-1 text-[11px]"
                            >
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Ativo
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="bg-rose-50 text-rose-800 border-rose-200 font-medium gap-1 text-[11px]"
                            >
                              <PowerOff className="w-3 h-3 text-rose-600" />
                              Desativado
                            </Badge>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Botão Editar Acessos (Módulos) */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenAccessModal(u)}
                              className="h-7 px-2.5 text-xs text-orange-700 hover:text-orange-900 hover:bg-orange-50 border-orange-200 gap-1 font-medium"
                              title="Configurar quais módulos este usuário pode acessar"
                            >
                              <Sliders className="w-3 h-3 text-orange-600" />
                              Editar Acessos
                            </Button>

                            {/* Botão Resetar Senha */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenResetModal(u)}
                              className="h-7 px-2.5 text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-100 border-slate-200 gap-1"
                              title="Gerar nova senha provisória para este usuário"
                            >
                              <KeyRound className="w-3 h-3 text-slate-500" />
                              Senha
                            </Button>

                            {/* Botão Alterar Papel */}
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isSelf}
                              onClick={() => {
                                setRoleModalUser(u)
                                setSelectedRole(u.role === 'admin' ? 'admin' : 'member')
                              }}
                              className={`h-7 px-2.5 text-xs border-slate-200 gap-1 ${
                                isSelf
                                  ? 'opacity-40 cursor-not-allowed'
                                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                              }`}
                              title={
                                isSelf
                                  ? 'Você não pode alterar seu próprio papel'
                                  : 'Alternar entre Administrador e Membro'
                              }
                            >
                              <ShieldCheck className="w-3 h-3 text-blue-600" />
                              Papel
                            </Button>

                            {/* Botão Ativar / Desativar */}
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isSelf}
                              onClick={() => setStatusModalUser(u)}
                              className={`h-7 px-2 text-xs border-slate-200 ${
                                isSelf
                                  ? 'opacity-40 cursor-not-allowed'
                                  : isActive
                                    ? 'text-rose-700 hover:bg-rose-50 border-rose-200'
                                    : 'text-emerald-700 hover:bg-emerald-50 border-emerald-200'
                              }`}
                              title={
                                isSelf
                                  ? 'Você não pode desativar a sua própria conta'
                                  : isActive
                                    ? 'Desativar acesso deste usuário'
                                    : 'Reativar conta do usuário'
                              }
                            >
                              {isActive ? (
                                <PowerOff className="w-3 h-3" />
                              ) : (
                                <Power className="w-3 h-3" />
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL: EDITAR ACESSOS / MÓDULOS POR USUÁRIO (SWITCHES LIGA/DESLIGA) */}
      <Dialog open={!!accessModalUser} onOpenChange={(open) => !open && setAccessModalUser(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Sliders className="w-5 h-5 text-orange-600" />
              Permissões por Módulo — {accessModalUser?.name || accessModalUser?.email}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Ligue ou desligue o acesso individual a cada módulo. O efeito é imediato na próxima
              navegação ou recarga do usuário.
            </DialogDescription>
          </DialogHeader>

          {accessModalUser?.role === 'admin' ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs space-y-2 my-2">
              <div className="flex items-center gap-2 font-bold text-amber-800 text-sm">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                Usuário com Papel de Administrador
              </div>
              <p>
                Usuários com papel de <strong>Administrador</strong> têm imunidade e possuem acesso
                integral a todos os módulos do AmbicorpFlow por regra de segurança do sistema.
              </p>
              <p className="text-[11px] text-amber-700">
                Para restringir o acesso a módulos específicos (como criar um usuário com apenas o
                Explorador de Catálogo), altere primeiro o papel do usuário para{' '}
                <strong>Membro</strong>.
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto pr-1 py-2 space-y-4">
              {/* Botões de Ação Rápida */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <span className="text-slate-600 font-medium">
                  Selecionados: <strong>{selectedModules.length}</strong> de {APP_MODULES.length}
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedModules(['explorador_catalogo'])}
                    className="h-7 px-2 text-[11px] text-blue-700 hover:bg-blue-50"
                  >
                    Apenas Explorador
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedModules(DEFAULT_MEMBER_MODULE_IDS)}
                    className="h-7 px-2 text-[11px] text-slate-700 hover:bg-slate-200"
                  >
                    Padrão (Dashboard + Vendas)
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedModules(ALL_MODULE_IDS)}
                    className="h-7 px-2 text-[11px] text-slate-700 hover:bg-slate-200"
                  >
                    Marcar Todos
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedModules([])}
                    className="h-7 px-2 text-[11px] text-rose-700 hover:bg-rose-50"
                  >
                    Desmarcar Todos
                  </Button>
                </div>
              </div>

              {/* Grid de Módulos com Switches */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {APP_MODULES.map((mod) => {
                  const Icon = mod.icon
                  const isChecked = selectedModules.includes(mod.id)
                  const isExplorador = mod.id === 'explorador_catalogo'

                  return (
                    <div
                      key={mod.id}
                      className={`p-3 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                        isChecked
                          ? isExplorador
                            ? 'bg-blue-50/50 border-blue-300'
                            : 'bg-orange-50/40 border-orange-200'
                          : 'bg-white border-slate-200 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            isChecked
                              ? isExplorador
                                ? 'bg-blue-600 text-white'
                                : 'bg-orange-600 text-white'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-xs text-slate-900 truncate">
                              {mod.label}
                            </span>
                            {mod.adminOnly && (
                              <Badge
                                variant="outline"
                                className="text-[9px] px-1 py-0 h-3.5 border-amber-300 text-amber-700 bg-amber-50"
                              >
                                Admin
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-snug">
                            {mod.description}
                          </p>
                        </div>
                      </div>

                      <Switch
                        checked={isChecked}
                        onCheckedChange={() => toggleModuleSelection(mod.id)}
                        className="data-[state=checked]:bg-orange-600 mt-1 flex-shrink-0"
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <DialogFooter className="pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAccessModalUser(null)}
              disabled={isSavingAccess}
              className="text-xs"
            >
              Cancelar
            </Button>
            {accessModalUser?.role !== 'admin' && (
              <Button
                type="button"
                size="sm"
                onClick={handleSaveAccess}
                disabled={isSavingAccess}
                className="bg-orange-600 hover:bg-orange-700 text-white text-xs gap-1.5"
              >
                {isSavingAccess ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Salvando Acessos...
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Salvar Permissões
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: CRIAR NOVO USUÁRIO COM MÓDULOS INICIAIS */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
              <UserPlus className="w-5 h-5 text-orange-600" />
              Cadastrar Novo Usuário & Definir Acessos
            </DialogTitle>
            <DialogDescription className="text-xs">
              Informe as credenciais e selecione exatamente os módulos que este usuário poderá
              acessar.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={handleCreateUser}
            className="flex-1 overflow-y-auto space-y-3.5 py-2 pr-1"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="create-name" className="text-xs text-slate-700">
                  Nome Completo
                </Label>
                <Input
                  id="create-name"
                  placeholder="Ex: Carlos Eduardo"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="text-xs h-9"
                  disabled={isCreating}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="create-email" className="text-xs text-slate-700">
                  E-mail de Login *
                </Label>
                <Input
                  id="create-email"
                  type="email"
                  placeholder="carlos@ambicorp.com.br"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                  className="text-xs h-9"
                  disabled={isCreating}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="create-password" className="text-xs text-slate-700">
                  Senha Provisória (Mínimo 8 caracteres) *
                </Label>
                <Input
                  id="create-password"
                  type="text"
                  placeholder="Defina uma senha de primeiro acesso"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="text-xs h-9 font-mono"
                  disabled={isCreating}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="create-role" className="text-xs text-slate-700">
                  Papel da Conta *
                </Label>
                <Select
                  value={newRole}
                  onValueChange={(val: 'admin' | 'member') => {
                    setNewRole(val)
                    if (val === 'admin') {
                      setNewModules(ALL_MODULE_IDS)
                    }
                  }}
                  disabled={isCreating}
                >
                  <SelectTrigger id="create-role" className="text-xs h-9">
                    <SelectValue placeholder="Selecione o papel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member" className="text-xs">
                      Membro (Permissões customizadas por módulo)
                    </SelectItem>
                    <SelectItem value="admin" className="text-xs">
                      Administrador (Acesso total imune)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Seleção de Módulos no Cadastro */}
            {newRole === 'member' && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label className="text-xs font-semibold text-slate-800">
                    Selecione os Módulos Liberados: ({newModules.length} selecionado(s))
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setNewModules(['explorador_catalogo'])}
                      className="h-6 px-2 text-[11px] text-blue-700 hover:bg-blue-50"
                    >
                      Só Explorador
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setNewModules(DEFAULT_MEMBER_MODULE_IDS)}
                      className="h-6 px-2 text-[11px] text-slate-600 hover:bg-slate-100"
                    >
                      Padrão
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setNewModules(ALL_MODULE_IDS)}
                      className="h-6 px-2 text-[11px] text-slate-600 hover:bg-slate-100"
                    >
                      Todos
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1 bg-slate-50/50 rounded-lg border border-slate-200">
                  {APP_MODULES.map((mod) => {
                    const isChecked = newModules.includes(mod.id)
                    const Icon = mod.icon
                    return (
                      <label
                        key={mod.id}
                        className={`p-2 rounded-lg border flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-orange-50 border-orange-200 text-orange-950'
                            : 'bg-white border-slate-200 text-slate-700 opacity-70'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Icon className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                          <span className="text-xs font-medium truncate">{mod.label}</span>
                        </div>
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleNewUserModule(mod.id)}
                          className="data-[state=checked]:bg-orange-600 data-[state=checked]:border-orange-600"
                        />
                      </label>
                    )
                  })}
                </div>
              </div>
            )}

            <DialogFooter className="pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCreateOpen(false)}
                disabled={isCreating}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isCreating || !newEmail || !newPassword}
                className="bg-orange-600 hover:bg-orange-700 text-white text-xs gap-1.5"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Cadastrando...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3.5 h-3.5" />
                    Criar Usuário com Acessos
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: RESET DE SENHA (EXIBIÇÃO ÚNICA DA SENHA) */}
      <Dialog
        open={!!resetModalData}
        onOpenChange={(open) => {
          if (!open) {
            setResetModalData(null)
            setCopiedPassword(false)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
              <KeyRound className="w-5 h-5 text-orange-600" />
              Resetar Senha de Usuário
            </DialogTitle>
            <DialogDescription className="text-xs">
              Usuário selecionado: <strong>{resetModalData?.user.email}</strong> (
              {resetModalData?.user.name})
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-3">
            {!resetModalData?.temporaryPassword ? (
              <>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs flex gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Atenção ao resetar</p>
                    <p className="mt-0.5">
                      Uma nova senha provisória será gerada aleatoriamente no servidor e atribuída a
                      esta conta. A senha atual deixará de funcionar imediatamente.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setResetModalData(null)}
                    disabled={resetModalData?.isResetting}
                    className="text-xs"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleExecuteResetPassword}
                    disabled={resetModalData?.isResetting}
                    className="bg-orange-600 hover:bg-orange-700 text-white text-xs gap-1.5"
                  >
                    {resetModalData?.isResetting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Gerando...
                      </>
                    ) : (
                      <>
                        <KeyRound className="w-3.5 h-3.5" />
                        Confirmar e Gerar Senha
                      </>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>
                    A senha foi redefinida com sucesso. Copie a senha provisória abaixo e envie ao
                    colaborador:
                  </span>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-slate-700 font-semibold">
                    Senha Provisória Gerada:
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={resetModalData.temporaryPassword}
                      className="font-mono text-sm bg-slate-100 font-bold tracking-wider select-all text-slate-900"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleCopyPassword}
                      className="bg-slate-900 hover:bg-slate-800 text-white text-xs h-9 gap-1.5 flex-shrink-0"
                    >
                      {copiedPassword ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          Copiada!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copiar
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-[11px] text-slate-400 pt-1">
                    Esta senha provisória não será exibida novamente por motivos de segurança.
                  </p>
                </div>

                <div className="flex justify-end pt-3">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setResetModalData(null)
                      setCopiedPassword(false)
                    }}
                    className="text-xs bg-slate-900 text-white"
                  >
                    Concluir
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL: ALTERAR PAPEL */}
      <Dialog open={!!roleModalUser} onOpenChange={(open) => !open && setRoleModalUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              Editar Papel de Usuário
            </DialogTitle>
            <DialogDescription className="text-xs">
              Modifique as permissões de acesso para <strong>{roleModalUser?.email}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="change-role-select" className="text-xs text-slate-700">
                Selecione o novo papel:
              </Label>
              <Select
                value={selectedRole}
                onValueChange={(val: 'admin' | 'member') => setSelectedRole(val)}
                disabled={isUpdatingRole}
              >
                <SelectTrigger id="change-role-select" className="text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member" className="text-xs">
                    Membro (Acessos customizados por módulo)
                  </SelectItem>
                  <SelectItem value="admin" className="text-xs">
                    Administrador (Acesso total imune)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRoleModalUser(null)}
                disabled={isUpdatingRole}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveRole}
                disabled={isUpdatingRole || selectedRole === roleModalUser?.role}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5"
              >
                {isUpdatingRole ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Alteração'
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL: CONFIRMAR ATIVAR / DESATIVAR */}
      <Dialog open={!!statusModalUser} onOpenChange={(open) => !open && setStatusModalUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
              {statusModalUser?.active === false ? (
                <>
                  <Power className="w-5 h-5 text-emerald-600" />
                  Reativar Usuário
                </>
              ) : (
                <>
                  <PowerOff className="w-5 h-5 text-rose-600" />
                  Desativar Usuário
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {statusModalUser?.active === false
                ? `Deseja restabelecer o acesso do usuário ${statusModalUser?.email}?`
                : `Deseja desativar o acesso de ${statusModalUser?.email}? Ele não poderá efetuar login enquanto estiver inativo.`}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setStatusModalUser(null)}
              disabled={isUpdatingStatus}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleToggleStatus}
              disabled={isUpdatingStatus}
              className={
                statusModalUser?.active === false
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white text-xs'
                  : 'bg-rose-600 hover:bg-rose-700 text-white text-xs'
              }
            >
              {isUpdatingStatus ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                  Processando...
                </>
              ) : statusModalUser?.active === false ? (
                'Confirmar Reativação'
              ) : (
                'Confirmar Desativação'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
