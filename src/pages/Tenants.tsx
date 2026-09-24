import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useTenant } from '@/contexts/TenantContext'
import { tenantsService } from '@/services/tenantsService'
import type { Tenant, TenantStats, TenantStatus } from '@/types/tenant'
import { MASTER_TENANT_ID, MASTER_TENANT_SLUG } from '@/types/tenant'
import { APP_MODULES, ALL_MODULE_IDS, type AppModuleId } from '@/types/modules'
import { formatTenantDomain } from '@/utils/tenantResolver'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import {
  Building2,
  Plus,
  Edit2,
  Trash2,
  Globe,
  Boxes,
  Users,
  ShoppingCart,
  Eye,
  CheckCircle2,
  Layers,
  Sparkles,
  ShieldAlert,
  Loader2,
  Copy,
  ExternalLink,
  Info,
} from 'lucide-react'

// Presets comerciais para facilitar ativação rápida de planos
const COMMERCIAL_PRESETS: {
  id: string
  name: string
  description: string
  modules: AppModuleId[]
}[] = [
  {
    id: 'basico',
    name: 'Básico (Vendas + Estoque)',
    description: 'Dashboard, Vendas, Produtos e Estoque de Lotes',
    modules: ['dashboard', 'vendas', 'produtos', 'estoque_lotes', 'ajustes'],
  },
  {
    id: 'profissional',
    name: 'Profissional (Operação + ML)',
    description: 'Básico + Gestor ML, Lotes de Compra e Notas Fiscais',
    modules: [
      'dashboard',
      'vendas',
      'produtos',
      'estoque_lotes',
      'lotes_compra',
      'ajustes',
      'gestor_ml',
      'notas_fiscais',
      'clientes',
      'configuracoes',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise / Completo',
    description: 'Todos os módulos do sistema ativados',
    modules: ALL_MODULE_IDS,
  },
]

export default function Tenants() {
  const { isSuperAdmin } = useAuth()
  const { currentTenant, switchTenant, refreshTenants } = useTenant()
  const { toast } = useToast()

  const [tenants, setTenants] = useState<Tenant[]>([])
  const [statsMap, setStatsMap] = useState<Record<string, TenantStats>>({})
  const [loading, setLoading] = useState(true)

  // Modais de Criação / Edição
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null)
  const [saving, setSaving] = useState(false)

  // Formulário
  const [formName, setFormName] = useState('')
  const [formSlug, setFormSlug] = useState('')
  const [formStatus, setFormStatus] = useState<TenantStatus>('ativo')
  const [formPlan, setFormPlan] = useState('Profissional')
  const [formNotes, setFormNotes] = useState('')
  const [formModules, setFormModules] = useState<AppModuleId[]>([])

  // Modal de Exclusão
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const list = await tenantsService.getAll()
      setTenants(list)

      // Carregar estatísticas para cada tenant
      const statsObj: Record<string, TenantStats> = {}
      for (const t of list) {
        try {
          const s = await tenantsService.getTenantStats(t.id)
          statsObj[t.id] = s
        } catch {
          /* intentionally ignored */
        }
      }
      setStatsMap(statsObj)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar clientes',
        description: err?.message || 'Falha ao buscar lista de tenants.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleOpenCreate = () => {
    setEditingTenant(null)
    setFormName('')
    setFormSlug('')
    setFormStatus('ativo')
    setFormPlan('Enterprise / Completo')
    setFormNotes('')
    setFormModules(ALL_MODULE_IDS) // Todos habilitados por padrão
    setIsModalOpen(true)
  }

  const handleOpenEdit = (tenant: Tenant) => {
    setEditingTenant(tenant)
    setFormName(tenant.name)
    setFormSlug(tenant.slug)
    setFormStatus(tenant.status)
    setFormPlan(tenant.plan || 'Enterprise / Completo')
    setFormNotes(tenant.commercial_notes || '')
    setFormModules(ALL_MODULE_IDS) // Todos habilitados por padrão
    setIsModalOpen(true)
  }

  const handleNameChange = (val: string) => {
    setFormName(val)
    if (!editingTenant) {
      // Auto-sugere slug simples
      const suggested = val
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '')
      setFormSlug(suggested)
    }
  }

  const handleApplyPreset = (presetId: string) => {
    const found = COMMERCIAL_PRESETS.find((p) => p.id === presetId)
    if (found) {
      setFormModules(found.modules)
      setFormPlan(found.name.split(' (')[0])
      toast({
        title: `Pacote "${found.name}" aplicado!`,
        description: `${found.modules.length} módulos foram selecionados. Você ainda pode ajustá-los individualmente.`,
      })
    }
  }

  const handleToggleModule = (_modId: AppModuleId) => {
    // Todos os módulos liberados globalmente no AmbicorpFlow
    toast({
      title: 'Módulos liberados',
      description:
        'Todos os módulos do sistema estão liberados permanentemente para todos os tenants.',
    })
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim() || !formSlug.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Informe o nome do cliente e o slug do subdomínio.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      if (editingTenant) {
        await tenantsService.update(editingTenant.id, {
          name: formName,
          slug: formSlug,
          status: formStatus,
          plan: formPlan,
          commercial_notes: formNotes,
          modules: formModules,
        })
        toast({
          title: 'Cliente atualizado com sucesso!',
          description: `Os módulos e dados de "${formName}" foram gravados.`,
        })
      } else {
        await tenantsService.create({
          name: formName,
          slug: formSlug,
          status: formStatus,
          plan: formPlan,
          commercial_notes: formNotes,
          modules: formModules,
        })
        toast({
          title: 'Cliente criado com sucesso!',
          description: `Subdomínio ${formSlug}.ambicorp.com.br pronto para acesso.`,
        })
      }
      setIsModalOpen(false)
      await refreshTenants()
      await loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar cliente',
        description: err?.message || 'Verifique se o slug já está em uso por outro cliente.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!tenantToDelete) return
    if (tenantToDelete.id === MASTER_TENANT_ID) {
      toast({
        title: 'Ação não permitida',
        description: 'O tenant mestre da Ambicorp não pode ser excluído.',
        variant: 'destructive',
      })
      return
    }

    setDeleting(true)
    try {
      await tenantsService.delete(tenantToDelete.id)
      toast({
        title: 'Cliente excluído!',
        description: `O cliente "${tenantToDelete.name}" foi removido do sistema.`,
      })
      setDeleteConfirmOpen(false)
      setTenantToDelete(null)
      await refreshTenants()
      await loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao excluir cliente',
        description: err?.message || 'Falha ao remover o registro.',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  const copyDomain = (slug: string) => {
    const domain = formatTenantDomain(slug)
    navigator.clipboard.writeText(domain)
    toast({
      title: 'Endereço copiado!',
      description: `URL ${domain} copiada para a área de transferência.`,
    })
  }

  if (!isSuperAdmin) {
    return (
      <div className="p-8 max-w-md mx-auto mt-16 bg-white rounded-2xl shadow-sm border border-slate-200 text-center">
        <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Acesso Exclusivo Super-Admin</h2>
        <p className="text-xs text-slate-600 mb-6 leading-relaxed">
          O gerenciamento multi-tenant de clientes é restrito ao administrador mestre da Ambicorp.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Building2 className="w-7 h-7 text-orange-500" />
            Gestão de Clientes & Subdomínios (Multi-Tenant)
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Administre seus clientes, configure os subdomínios (slug.ambicorp.com.br) e
            ligue/desligue os módulos contratados.
          </p>
        </div>

        <Button
          onClick={handleOpenCreate}
          className="bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs h-9 gap-1.5 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Novo Cliente (Tenant)
        </Button>
      </div>

      {/* Caixa de Ajuda Operacional sobre DNS Wildcard e Acesso */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 shadow-xs">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 rounded-lg text-blue-700 shrink-0">
              <Globe className="w-5 h-5" />
            </div>
            <div className="space-y-1.5 text-xs text-slate-700">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                Como funciona o acesso por subdomínio dos seus clientes
              </h4>
              <p className="text-slate-600 leading-relaxed">
                Cada cliente possui seu próprio endereço exclusivo:{' '}
                <strong>slug.ambicorp.com.br</strong> (ex: <code>cliente1.ambicorp.com.br</code>). O
                sistema identifica o cliente automaticamente pelo hostname.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1 font-medium bg-white px-2 py-0.5 rounded border border-blue-200 text-blue-800">
                  <Info className="w-3.5 h-3.5 text-blue-600" />
                  Nota operacional DNS:
                </span>
                <span>
                  Apontar entrada DNS wildcard <code>*.ambicorp.com.br</code> (ou CNAME por cliente)
                  no seu provedor de domínio para o IP/servidor do sistema.
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid de Tenants */}
      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          <span className="text-xs">Carregando instâncias e estatísticas dos clientes...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
          {tenants.map((t) => {
            const isMaster = t.id === MASTER_TENANT_ID || t.slug === MASTER_TENANT_SLUG
            const isCurrentlyActive = currentTenant?.id === t.id
            const stats = statsMap[t.id]
            const domain = formatTenantDomain(t.slug)

            return (
              <Card
                key={t.id}
                className={`transition-all duration-200 border ${
                  isCurrentlyActive
                    ? 'border-orange-500 shadow-md ring-2 ring-orange-500/20 bg-orange-50/10'
                    : 'border-slate-200 hover:border-slate-300 shadow-xs bg-white'
                }`}
              >
                <CardHeader className="p-4 sm:p-5 pb-3 border-b border-slate-100">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-base font-bold text-slate-900 truncate">
                          {t.name}
                        </CardTitle>
                        {isMaster ? (
                          <Badge className="bg-purple-600 text-white text-[10px] font-bold">
                            Matriz / Mestre
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-semibold capitalize ${
                              t.status === 'ativo'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : t.status === 'suspenso'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {t.status}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono truncate">
                        <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-slate-700 font-medium">{domain}</span>
                        <button
                          type="button"
                          onClick={() => copyDomain(t.slug)}
                          className="text-slate-400 hover:text-slate-700 p-0.5 rounded"
                          title="Copiar subdomínio"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {isCurrentlyActive && (
                      <Badge className="bg-orange-500 text-white text-[10px] shrink-0">
                        Ativo agora
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="p-4 sm:p-5 space-y-4">
                  {/* Plano e Notas */}
                  <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                        Plano Comercial
                      </span>
                      <span className="font-semibold text-slate-800">
                        {t.plan || 'Personalizado'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                        Módulos Ativos
                      </span>
                      <span className="font-bold text-emerald-600">
                        {ALL_MODULE_IDS.length} de {ALL_MODULE_IDS.length} (Todos Liberados)
                      </span>
                    </div>
                  </div>

                  {/* Estatísticas de Dados Isolados */}
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="p-2 bg-slate-50 rounded border border-slate-100">
                      <Boxes className="w-3.5 h-3.5 mx-auto text-slate-500 mb-1" />
                      <span className="block font-bold text-slate-800 text-sm">
                        {stats?.productsCount ?? 0}
                      </span>
                      <span className="text-[10px] text-slate-500">Produtos</span>
                    </div>
                    <div className="p-2 bg-slate-50 rounded border border-slate-100">
                      <Layers className="w-3.5 h-3.5 mx-auto text-slate-500 mb-1" />
                      <span className="block font-bold text-slate-800 text-sm">
                        {stats?.batchesCount ?? 0}
                      </span>
                      <span className="text-[10px] text-slate-500">Lotes</span>
                    </div>
                    <div className="p-2 bg-slate-50 rounded border border-slate-100">
                      <ShoppingCart className="w-3.5 h-3.5 mx-auto text-slate-500 mb-1" />
                      <span className="block font-bold text-slate-800 text-sm">
                        {stats?.salesCount ?? 0}
                      </span>
                      <span className="text-[10px] text-slate-500">Vendas</span>
                    </div>
                    <div className="p-2 bg-slate-50 rounded border border-slate-100">
                      <Users className="w-3.5 h-3.5 mx-auto text-slate-500 mb-1" />
                      <span className="block font-bold text-slate-800 text-sm">
                        {stats?.usersCount ?? 0}
                      </span>
                      <span className="text-[10px] text-slate-500">Usuários</span>
                    </div>
                  </div>

                  {/* Resumo visual de Módulos Habilitados */}
                  <div>
                    <span className="text-[11px] font-semibold text-slate-700 block mb-1.5">
                      Recursos liberados para este cliente:
                    </span>
                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                      {ALL_MODULE_IDS.map((mId) => {
                        const mod = APP_MODULES.find((m) => m.id === mId)
                        return (
                          <span
                            key={mId}
                            className="inline-flex items-center text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-medium"
                          >
                            {mod?.label || mId}
                          </span>
                        )
                      })}
                    </div>
                  </div>

                  {/* Ações do Card */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={isCurrentlyActive ? 'secondary' : 'outline'}
                      onClick={() => switchTenant(t.id)}
                      className="text-xs h-8 gap-1.5 font-medium flex-1"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-600" />
                      {isCurrentlyActive ? 'Visualizando' : 'Ver como cliente'}
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenEdit(t)}
                      className="text-xs h-8 text-slate-700 hover:bg-slate-50"
                      title="Editar cliente e módulos"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>

                    {!isMaster && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setTenantToDelete(t)
                          setDeleteConfirmOpen(true)
                        }}
                        className="text-xs h-8 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                        title="Excluir cliente"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal de Criação / Edição de Tenant */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-orange-600" />
                {editingTenant
                  ? `Editar Cliente: ${editingTenant.name}`
                  : 'Cadastrar Novo Cliente (Tenant)'}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Configure os dados da conta do cliente e selecione exatamente os módulos que ele
                poderá acessar.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-5 text-xs">
              {/* Informações Básicas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="tenant-name" className="text-xs font-semibold text-slate-700">
                    Nome da Empresa / Cliente *
                  </Label>
                  <Input
                    id="tenant-name"
                    placeholder="Ex: Informática Silva & Cia"
                    value={formName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    required
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="tenant-slug" className="text-xs font-semibold text-slate-700">
                    Slug do Subdomínio (único) *
                  </Label>
                  <div className="relative">
                    <Input
                      id="tenant-slug"
                      placeholder="silva"
                      value={formSlug}
                      onChange={(e) =>
                        setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))
                      }
                      required
                      disabled={editingTenant?.id === MASTER_TENANT_ID}
                      className="h-9 text-xs font-mono pr-28"
                    />
                    <span className="absolute right-2.5 top-2.5 text-[11px] text-slate-400 font-mono pointer-events-none">
                      .ambicorp.com.br
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Endereço de acesso: <strong>{formSlug || 'slug'}.ambicorp.com.br</strong>
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="tenant-status" className="text-xs font-semibold text-slate-700">
                    Status da Conta
                  </Label>
                  <Select
                    value={formStatus}
                    onValueChange={(val: TenantStatus) => setFormStatus(val)}
                  >
                    <SelectTrigger id="tenant-status" className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo" className="text-xs">
                        🟢 Ativo (Acesso normal)
                      </SelectItem>
                      <SelectItem value="suspenso" className="text-xs">
                        🟡 Suspenso (Pagamento/Atraso)
                      </SelectItem>
                      <SelectItem value="inativo" className="text-xs">
                        🔴 Inativo (Bloqueado)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="tenant-plan" className="text-xs font-semibold text-slate-700">
                    Plano Comercial Contratado
                  </Label>
                  <Input
                    id="tenant-plan"
                    placeholder="Ex: Profissional ML + NF-e"
                    value={formPlan}
                    onChange={(e) => setFormPlan(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              {/* Presets Rápidos de Pacotes */}
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-950 text-xs flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    Presets Comerciais Rápidos:
                  </span>
                  <span className="text-[11px] text-amber-800">
                    Clique para pré-selecionar os módulos
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {COMMERCIAL_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleApplyPreset(preset.id)}
                      className="p-2 text-left bg-white hover:bg-amber-100/60 border border-amber-200 rounded-md transition-colors"
                    >
                      <div className="font-semibold text-slate-900 text-xs">{preset.name}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                        {preset.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggles Individuais por Módulo — Neutralizados: todos liberados */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-bold text-emerald-950 text-xs">
                    Todos os {ALL_MODULE_IDS.length} módulos estão liberados por padrão
                  </span>
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  Conforme a política do AmbicorpFlow, este cliente possui acesso total e irrestrito
                  a todos os módulos da plataforma (Dashboard, Compra de Lotes, Estoque, Catálogo,
                  Vendas, Gestor ML, Notas Fiscais e demais ferramentas).
                </p>
                <div className="flex flex-wrap gap-1 pt-1 max-h-36 overflow-y-auto">
                  {APP_MODULES.map((mod) => (
                    <span
                      key={mod.id}
                      className="inline-flex items-center text-[10px] bg-white text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-medium"
                    >
                      ✓ {mod.label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Anotações Comerciais */}
              <div className="space-y-1.5">
                <Label htmlFor="tenant-notes" className="text-xs font-semibold text-slate-700">
                  Anotações Comerciais Internas (Opcional)
                </Label>
                <Input
                  id="tenant-notes"
                  placeholder="Ex: Mensalidade R$ 490/mês, vence todo dia 10. Suporte via WhatsApp."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="border-t border-slate-100 pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsModalOpen(false)}
                className="text-xs h-9"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs h-9 gap-1.5"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {editingTenant ? 'Salvar Alterações' : 'Criar Cliente'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmação de Exclusão (Dupla Proteção) */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-900 font-bold flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
              Excluir Cliente "{tenantToDelete?.name}"?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600 space-y-2">
              <p>
                Tem certeza de que deseja remover esta conta de cliente? Esta ação removerá a
                configuração do tenant no sistema.
              </p>
              <p className="font-semibold text-rose-700">
                Esta ação é irreversível. O tenant mestre da Ambicorp nunca pode ser removido.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} className="text-xs h-9">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs h-9 gap-1.5"
            >
              {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Confirmar Exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
