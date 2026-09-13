import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Users,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Package,
  MessageSquare,
  DollarSign,
  Plus,
  Trash2,
  KeyRound,
  HelpCircle,
  PauseCircle,
  Eye,
  Info,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { useToast } from '@/hooks/use-toast'
import {
  mlSellersService,
  type MLSellerRecord,
  type MLSellersKPIs,
} from '@/services/mlSellersService'

export function MLSellersMonitorTab() {
  const { toast } = useToast()

  const [sellers, setSellers] = useState<MLSellerRecord[]>([])
  const [kpis, setKpis] = useState<MLSellersKPIs>({
    total_sellers: 0,
    total_active_ads: 0,
    total_30d_sales: 0,
    total_30d_amount: 0,
    alert_count: 0,
    unauthorized_count: 0,
  })
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncingSellerId, setSyncingSellerId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'alerts' | 'connected' | 'unauthorized' | 'demo'
  >('all')

  // Modais
  const [reauthModalOpen, setReauthModalOpen] = useState(false)
  const [selectedSellerForReauth, setSelectedSellerForReauth] = useState<MLSellerRecord | null>(
    null,
  )
  const [newAccessToken, setNewAccessToken] = useState('')
  const [reauthing, setReauthing] = useState(false)

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [newSellerId, setNewSellerId] = useState('')
  const [newSellerNickname, setNewSellerNickname] = useState('')
  const [newSellerType, setNewSellerType] = useState<'connected' | 'demo'>('connected')
  const [newSellerNotes, setNewSellerNotes] = useState('')
  const [newSellerToken, setNewSellerToken] = useState('')
  const [creating, setCreating] = useState(false)

  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [viewingSeller, setViewingSeller] = useState<MLSellerRecord | null>(null)

  // Carregar lista de sellers
  const loadSellers = useCallback(
    async (isPolling = false) => {
      if (!isPolling) setLoading(true)
      try {
        const res = await mlSellersService.listSellers()
        if (res.ok) {
          setSellers(res.sellers)
          setKpis(res.kpis)
        } else {
          if (!isPolling) {
            toast({
              title: 'Aviso ao carregar monitor de sellers',
              description: res.error || 'Não foi possível carregar os sellers.',
              variant: 'destructive',
            })
          }
        }
      } catch (err: any) {
        if (!isPolling) {
          toast({
            title: 'Erro de comunicação',
            description: err?.message || 'Falha ao conectar com o serviço.',
            variant: 'destructive',
          })
        }
      } finally {
        if (!isPolling) setLoading(false)
      }
    },
    [toast],
  )

  // Polling leve a cada 60s
  useEffect(() => {
    loadSellers()
    const interval = setInterval(() => {
      loadSellers(true)
    }, 60000)
    return () => clearInterval(interval)
  }, [loadSellers])

  // Sincronizar todos ou um específico
  const handleSync = async (sellerId?: string) => {
    if (sellerId) {
      setSyncingSellerId(sellerId)
    } else {
      setSyncing(true)
    }

    try {
      const res = await mlSellersService.syncSellers(sellerId)
      if (res.ok) {
        toast({
          title: 'Sincronização concluída',
          description: sellerId
            ? 'Dados do seller atualizados com sucesso.'
            : `${res.synced_count} seller(s) sincronizado(s) via Mercado Livre.`,
        })
        await loadSellers(true)
      } else {
        toast({
          title: 'Falha na sincronização',
          description: res.error || 'Erro ao sincronizar dados.',
          variant: 'destructive',
        })
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao sincronizar',
        description: err?.message || 'Falha na requisição.',
        variant: 'destructive',
      })
    } finally {
      setSyncing(false)
      setSyncingSellerId(null)
    }
  }

  // Executar reautenticação
  const handleReauthSubmit = async (simulated = false) => {
    if (!selectedSellerForReauth) return
    setReauthing(true)
    try {
      const res = await mlSellersService.reauthSeller({
        seller_id: selectedSellerForReauth.seller_id,
        access_token: simulated ? undefined : newAccessToken.trim() || undefined,
        simulated_demo_fix: simulated,
      })

      if (res.ok) {
        toast({
          title: 'Conta reautenticada!',
          description: res.message || 'Sincronização restabelecida com sucesso.',
        })
        setReauthModalOpen(false)
        setSelectedSellerForReauth(null)
        setNewAccessToken('')
        await loadSellers(true)
      } else {
        toast({
          title: 'Não foi possível reautenticar',
          description: res.error || 'Verifique as credenciais e tente novamente.',
          variant: 'destructive',
        })
      }
    } catch (err: any) {
      toast({
        title: 'Erro na reautenticação',
        description: err?.message || 'Falha de comunicação.',
        variant: 'destructive',
      })
    } finally {
      setReauthing(false)
    }
  }

  // Criar novo seller
  const handleCreateSeller = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSellerId.trim() || !newSellerNickname.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Informe o ID e o apelido do vendedor.',
        variant: 'destructive',
      })
      return
    }

    setCreating(true)
    try {
      const res = await mlSellersService.createSeller({
        seller_id: newSellerId.trim(),
        nickname: newSellerNickname.trim(),
        seller_type: newSellerType,
        notes: newSellerNotes.trim(),
        access_token: newSellerToken.trim() || undefined,
      })

      if (res.ok) {
        toast({
          title: 'Seller cadastrado',
          description: 'O vendedor agora faz parte do monitor de parceiros.',
        })
        setCreateModalOpen(false)
        setNewSellerId('')
        setNewSellerNickname('')
        setNewSellerNotes('')
        setNewSellerToken('')
        await loadSellers(true)
      } else {
        toast({
          title: 'Erro ao cadastrar',
          description: res.error || 'Não foi possível cadastrar o seller.',
          variant: 'destructive',
        })
      }
    } catch (err: any) {
      toast({
        title: 'Erro de cadastro',
        description: err?.message || 'Falha ao salvar seller.',
        variant: 'destructive',
      })
    } finally {
      setCreating(false)
    }
  }

  // Deletar seller
  const handleDeleteSeller = async (seller: MLSellerRecord) => {
    if (seller.nickname === 'INFOPRECOBAIXO' || seller.seller_id === '626774396') {
      toast({
        title: 'Ação não permitida',
        description: 'A conta oficial principal não pode ser removida.',
        variant: 'destructive',
      })
      return
    }

    if (!confirm(`Deseja remover o monitoramento do vendedor "${seller.nickname}"?`)) {
      return
    }

    try {
      const res = await mlSellersService.deleteSeller(seller.id)
      if (res.ok) {
        toast({
          title: 'Seller removido',
          description: `O vendedor ${seller.nickname} foi excluído do monitor.`,
        })
        await loadSellers(true)
      } else {
        toast({
          title: 'Erro ao remover',
          description: res.error || 'Não foi possível excluir o vendedor.',
          variant: 'destructive',
        })
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao remover',
        description: err?.message || 'Falha na requisição.',
        variant: 'destructive',
      })
    }
  }

  // Helpers de formatação
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(val || 0)
  }

  const getReputationBadge = (level: string, powerStatus?: string | null) => {
    const isGreen = level?.includes('green') || level?.includes('5_') || level?.includes('4_')
    const isYellow = level?.includes('yellow') || level?.includes('3_')
    const isOrange = level?.includes('orange') || level?.includes('2_')
    const isRed = level?.includes('red') || level?.includes('1_')

    let colorClasses = 'bg-emerald-100 text-emerald-800 border-emerald-300'
    let label = 'Nível Verde (Líder)'

    if (isYellow) {
      colorClasses = 'bg-yellow-100 text-yellow-800 border-yellow-300'
      label = 'Nível Amarelo'
    } else if (isOrange) {
      colorClasses = 'bg-orange-100 text-orange-800 border-orange-300'
      label = 'Nível Laranja'
    } else if (isRed) {
      colorClasses = 'bg-rose-100 text-rose-800 border-rose-300'
      label = 'Nível Vermelho (Crítico)'
    }

    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <Badge variant="outline" className={`text-[10px] font-semibold ${colorClasses}`}>
          {label}
        </Badge>
        {powerStatus && (
          <Badge
            variant="outline"
            className="text-[10px] font-bold bg-amber-50 text-amber-800 border-amber-300 uppercase"
          >
            MercadoLíder {powerStatus}
          </Badge>
        )}
      </div>
    )
  }

  const getAuthStatusDisplay = (status: string, message?: string) => {
    switch (status) {
      case 'connected':
        return {
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
          badge: (
            <Badge className="bg-emerald-500 text-white text-[10px] hover:bg-emerald-600">
              🟢 Conectado / Monitorando
            </Badge>
          ),
          text: message || 'Monitoramento ativo e sincronizado via credenciais oficiais.',
        }
      case 'expiring':
        return {
          icon: <Clock className="w-3.5 h-3.5 text-amber-600" />,
          badge: (
            <Badge className="bg-amber-500 text-white text-[10px] hover:bg-amber-600">
              🟡 Token Expirando
            </Badge>
          ),
          text: message || 'O token deste seller expira em breve. Renovação programada.',
        }
      case 'unauthorized':
        return {
          icon: <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />,
          badge: (
            <Badge className="bg-rose-600 text-white text-[10px] hover:bg-rose-700 animate-pulse">
              🔴 Reautenticação Necessária
            </Badge>
          ),
          text:
            message ||
            'Sessão do Mercado Livre expirada (HTTP 401). Necessário reconectar a conta.',
        }
      case 'demo':
        return {
          icon: <Sparkles className="w-3.5 h-3.5 text-purple-600" />,
          badge: (
            <Badge className="bg-purple-100 text-purple-800 border-purple-300 text-[10px]">
              🟣 Seller Demonstrativo
            </Badge>
          ),
          text: message || 'Vendedor de demonstração com KPIs de exemplo.',
        }
      default:
        return {
          icon: <Info className="w-3.5 h-3.5 text-blue-600" />,
          badge: (
            <Badge className="bg-blue-100 text-blue-800 border-blue-300 text-[10px]">
              🔵 Dados Públicos
            </Badge>
          ),
          text: message || 'Monitoramento via catálogo público do Mercado Livre.',
        }
    }
  }

  // Filtragem dos sellers
  const filteredSellers = useMemo(() => {
    return sellers.filter((s) => {
      const matchSearch =
        search.trim() === '' ||
        s.nickname.toLowerCase().includes(search.toLowerCase()) ||
        s.seller_id.toLowerCase().includes(search.toLowerCase()) ||
        (s.notes && s.notes.toLowerCase().includes(search.toLowerCase()))

      if (!matchSearch) return false

      if (statusFilter === 'alerts') {
        return s.auth_status === 'unauthorized' || s.paused_spike_alert || s.reputation_drop_alert
      }
      if (statusFilter === 'connected') {
        return s.auth_status === 'connected'
      }
      if (statusFilter === 'unauthorized') {
        return s.auth_status === 'unauthorized'
      }
      if (statusFilter === 'demo') {
        return s.seller_type === 'demo' || s.auth_status === 'demo'
      }

      return true
    })
  }, [sellers, search, statusFilter])

  return (
    <div className="space-y-6">
      {/* Top Banner de Alertas se houver sellers com problemas */}
      {kpis.alert_count > 0 && (
        <div className="p-4 rounded-xl border border-amber-300 bg-amber-50/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-500 text-slate-950 rounded-lg flex-shrink-0 mt-0.5 sm:mt-0">
              <ShieldAlert className="w-5 h-5 font-bold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-amber-950">
                  Atenção Operacional: {kpis.alert_count} alerta(s) ativo(s) nos sellers monitorados
                </h4>
                <Badge className="bg-amber-600 text-white text-[10px] font-bold">
                  {kpis.unauthorized_count > 0
                    ? `${kpis.unauthorized_count} Reautenticação Pendente`
                    : 'Monitor Ativo'}
                </Badge>
              </div>
              <p className="text-xs text-amber-900 mt-0.5">
                Existem sellers com sessão expirada (ex: TAY TECH com erro 401) ou picos de anúncios
                pausados recentemente. Clique em <strong>Reautenticar</strong> para restabelecer a
                coleta em tempo real.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setStatusFilter('alerts')}
              className="text-xs h-8 border-amber-400 bg-white hover:bg-amber-100 text-amber-950 font-semibold"
            >
              Filtrar Somente Alertas ({kpis.alert_count})
            </Button>
          </div>
        </div>
      )}

      {/* Cabeçalho do Módulo & Botões de Ação */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-600 text-white flex items-center justify-center shadow-xs">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                Monitor de Sellers & Revendedores Parceiros
                <Badge variant="outline" className="text-[10px] bg-slate-100 font-mono">
                  {sellers.length} Monitorados
                </Badge>
              </h3>
              <p className="text-xs text-slate-500">
                Acompanhamento em tempo real de sellers próprios e parceiros revendedores de lotes
                corporativos.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleSync()}
            disabled={syncing}
            className="text-xs h-9 gap-1.5 border-slate-300 hover:bg-slate-50 shadow-2xs"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-amber-600' : 'text-slate-600'}`}
            />
            {syncing ? 'Sincronizando Sellers...' : 'Sincronizar Agora'}
          </Button>

          <Button
            size="sm"
            onClick={() => setCreateModalOpen(true)}
            className="text-xs h-9 bg-orange-600 hover:bg-orange-700 text-white font-bold gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Adicionar Seller
          </Button>
        </div>
      </div>

      {/* KPI Cards Consolidados */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-slate-200 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block">
                Sellers Monitorados
              </span>
              <Users className="w-4 h-4 text-orange-600" />
            </div>
            <span className="text-2xl font-black text-slate-900 mt-1 block font-mono">
              {kpis.total_sellers}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              Própria + Revendedores Parceiros
            </span>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-emerald-600 font-bold block">
                Anúncios Ativos
              </span>
              <Package className="w-4 h-4 text-emerald-600" />
            </div>
            <span className="text-2xl font-black text-emerald-700 mt-1 block font-mono">
              {kpis.total_active_ads}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              Somatório de ofertas no ar
            </span>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-blue-600 font-bold block">
                Vendas (30 Dias)
              </span>
              <TrendingUp className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-2xl font-black text-blue-700 mt-1 block font-mono">
              {kpis.total_30d_sales} un.
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              {formatCurrency(kpis.total_30d_amount)} movimentados
            </span>
          </CardContent>
        </Card>

        <Card
          className={`border-slate-200 shadow-xs ${kpis.alert_count > 0 ? 'bg-amber-50/50 border-amber-300' : ''}`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span
                className={`text-[11px] uppercase tracking-wider font-bold block ${kpis.alert_count > 0 ? 'text-amber-800' : 'text-slate-500'}`}
              >
                Alertas Ativos
              </span>
              <ShieldAlert
                className={`w-4 h-4 ${kpis.alert_count > 0 ? 'text-amber-600' : 'text-slate-400'}`}
              />
            </div>
            <span
              className={`text-2xl font-black mt-1 block font-mono ${kpis.alert_count > 0 ? 'text-amber-700' : 'text-slate-800'}`}
            >
              {kpis.alert_count}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              {kpis.unauthorized_count} precisam de reautenticação
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros e Busca */}
      <Card className="border-slate-200 shadow-xs">
        <CardContent className="p-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Input
                placeholder="Buscar por seller (ex: TAY TECH, INFOPRECOBAIXO, ID ou notas)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="text-xs h-9 bg-slate-50 border-slate-200"
              />
            </div>

            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                <SelectTrigger className="text-xs h-9 w-[180px] bg-slate-50 border-slate-200">
                  <SelectValue placeholder="Status de Conexão" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os sellers</SelectItem>
                  <SelectItem value="alerts">Com Alertas ({kpis.alert_count})</SelectItem>
                  <SelectItem value="connected">🟢 Conectados</SelectItem>
                  <SelectItem value="unauthorized">🔴 Reautenticação (401)</SelectItem>
                  <SelectItem value="demo">🟣 Somente Demo</SelectItem>
                </SelectContent>
              </Select>

              {statusFilter !== 'all' && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setStatusFilter('all')}
                  className="text-xs h-8 text-slate-500 hover:text-slate-800"
                >
                  Limpar
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Cards de Sellers */}
      {loading ? (
        <div className="p-16 text-center text-slate-400 space-y-3 bg-white rounded-xl border border-slate-200">
          <RefreshCw className="w-8 h-8 mx-auto animate-spin text-orange-500" />
          <p className="text-sm font-semibold text-slate-700">
            Carregando dados dos sellers monitorados...
          </p>
        </div>
      ) : filteredSellers.length === 0 ? (
        <Card className="border-dashed border-slate-300 shadow-none bg-slate-50/50">
          <CardContent className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center mx-auto">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 text-base">Nenhum seller encontrado</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Ajuste os filtros de busca ou clique em &quot;Adicionar Seller&quot; para incluir um
              parceiro comercial.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSellers.map((seller) => {
            const authInfo = getAuthStatusDisplay(seller.auth_status, seller.status_message)
            const isTay = seller.seller_id.includes('TAY') || seller.nickname.includes('TAY')
            const isOwn = seller.seller_id === '626774396' || seller.nickname === 'INFOPRECOBAIXO'

            return (
              <Card
                key={seller.id}
                className={`border transition-all shadow-xs flex flex-col justify-between ${
                  seller.auth_status === 'unauthorized'
                    ? 'border-rose-300 bg-rose-50/20 ring-1 ring-rose-200'
                    : seller.paused_spike_alert || seller.reputation_drop_alert
                      ? 'border-amber-300 bg-amber-50/10'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div>
                  <CardHeader className="p-4 pb-3 border-b border-slate-100">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-900 text-base flex items-center gap-1.5">
                            {seller.nickname}
                            {isOwn && (
                              <Badge className="bg-orange-600 text-white text-[9px] px-1.5 py-0 h-4">
                                Própria
                              </Badge>
                            )}
                          </h4>
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono">
                          ID ML: {seller.seller_id}
                        </p>
                      </div>

                      <div>{authInfo.badge}</div>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between">
                      {getReputationBadge(seller.reputation_level, seller.power_seller_status)}
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 space-y-4">
                    {/* Mensagem amigável de status / diagnóstico */}
                    <div
                      className={`p-2.5 rounded-lg text-xs leading-relaxed border ${
                        seller.auth_status === 'unauthorized'
                          ? 'bg-rose-50 border-rose-200 text-rose-900'
                          : seller.paused_spike_alert || seller.reputation_drop_alert
                            ? 'bg-amber-50 border-amber-200 text-amber-900'
                            : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {authInfo.icon}
                        <div className="flex-1">
                          <span className="font-semibold block">Diagnóstico da Conexão:</span>
                          <span className="text-[11px]">{authInfo.text}</span>
                        </div>
                      </div>

                      {/* Botão de destaque para Reautenticação se estiver 401 */}
                      {seller.auth_status === 'unauthorized' && (
                        <div className="mt-2.5 pt-2 border-t border-rose-200/80 flex items-center justify-between">
                          <span className="text-[10px] text-rose-700 font-medium">
                            {isTay ? 'Problema conhecido (401 revogado)' : 'Sessão desativada'}
                          </span>
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedSellerForReauth(seller)
                              setReauthModalOpen(true)
                            }}
                            className="bg-rose-600 hover:bg-rose-700 text-white text-xs h-7 px-3 font-bold gap-1 shadow-xs"
                          >
                            <KeyRound className="w-3 h-3" />
                            Reautenticar Agora
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Alertas específicos deste seller */}
                    {seller.paused_spike_alert && (
                      <div className="p-2 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                        <span>
                          Atenção: Houve um salto anormal de anúncios pausados recentemente.
                        </span>
                      </div>
                    )}
                    {seller.reputation_drop_alert && (
                      <div className="p-2 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                        <span>Alerta de reputação: Termômetro fora do nível verde.</span>
                      </div>
                    )}

                    {/* Grade de KPIs do Seller */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Anúncios Ativos
                        </span>
                        <span className="text-base font-black text-slate-800 font-mono mt-0.5 block">
                          {seller.active_ads_count}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {seller.paused_ads_count} pausados
                        </span>
                      </div>

                      <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Vendas (30 Dias)
                        </span>
                        <span className="text-base font-black text-emerald-700 font-mono mt-0.5 block">
                          {seller.sales_30d_count} un.
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {formatCurrency(seller.sales_30d_amount)}
                        </span>
                      </div>

                      <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Vendas (7 Dias)
                        </span>
                        <span className="text-base font-black text-blue-700 font-mono mt-0.5 block">
                          {seller.sales_7d_count} un.
                        </span>
                        <span className="text-[10px] text-slate-500">Ritmo semanal</span>
                      </div>

                      <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Perguntas Pendentes
                        </span>
                        <span className="text-base font-black text-amber-700 font-mono mt-0.5 block">
                          {seller.pending_questions_count}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Média: {seller.avg_response_time_minutes} min
                        </span>
                      </div>
                    </div>

                    {seller.notes && (
                      <p className="text-[11px] text-slate-500 italic bg-slate-50/50 p-2 rounded-md border border-slate-100">
                        Nota: {seller.notes}
                      </p>
                    )}
                  </CardContent>
                </div>

                <div className="p-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {seller.last_synced_at
                      ? `Sync: ${new Date(seller.last_synced_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                      : 'Não sincronizado'}
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setViewingSeller(seller)
                        setDetailsModalOpen(true)
                      }}
                      className="h-7 text-xs px-2 text-slate-600 hover:text-slate-900"
                      title="Ver detalhes técnicos"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={syncingSellerId === seller.seller_id}
                      onClick={() => handleSync(seller.seller_id)}
                      className="h-7 text-xs px-2 text-slate-600 hover:text-slate-900"
                      title="Sincronizar agora"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${syncingSellerId === seller.seller_id ? 'animate-spin text-orange-600' : ''}`}
                      />
                    </Button>

                    {!isOwn && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteSeller(seller)}
                        className="h-7 text-xs px-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                        title="Remover seller"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal de Reautenticação (Solução do 401 da TAY TECH) */}
      <Dialog open={reauthModalOpen} onOpenChange={setReauthModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-slate-900">
              <KeyRound className="w-5 h-5 text-rose-600" />
              Reautenticação: {selectedSellerForReauth?.nickname}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Corrija o erro 401 Unauthorized restabelecendo a credencial oficial do Mercado Livre.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 space-y-1">
              <span className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                Diagnóstico do 401 identificado:
              </span>
              <p className="text-[11px] leading-relaxed">
                O token de acesso associado a <strong>
                  {selectedSellerForReauth?.nickname}
                </strong>{' '}
                expirou ou a autorização OAuth foi revogada no Mercado Livre. Nenhum dado é
                modificado sem a sua permissão (o monitor é estritamente somente-leitura).
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-slate-700">
                Opção 1: Inserir Novo Access Token (Gerado no ML Developer)
              </Label>
              <Input
                placeholder="Ex: APP_USR-..."
                value={newAccessToken}
                onChange={(e) => setNewAccessToken(e.target.value)}
                className="text-xs h-9 font-mono"
              />
              <span className="text-[10px] text-slate-400">
                Se o parceiro lhe forneceu um token renovado de API, cole-o acima.
              </span>
            </div>

            <div className="pt-2 border-t border-slate-200">
              <Label className="text-xs text-slate-700 block mb-1">
                Opção 2: Reconexão de Teste / Simulação (Ambiente Parceiro)
              </Label>
              <p className="text-[11px] text-slate-500 mb-3">
                Simula a recepção de um novo token válido para liberar as métricas da{' '}
                <strong>TAY TECH</strong> no monitor sem esperar o retorno do revendedor.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleReauthSubmit(true)}
                disabled={reauthing}
                className="w-full text-xs h-8 border-orange-300 text-orange-700 hover:bg-orange-50 font-semibold gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Reconectar com Token Simulado de Demonstração
              </Button>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setReauthModalOpen(false)}
              className="text-xs h-8 text-slate-500"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={reauthing || !newAccessToken.trim()}
              onClick={() => handleReauthSubmit(false)}
              className="bg-orange-600 hover:bg-orange-700 text-white text-xs h-8 font-bold"
            >
              {reauthing ? 'Validando...' : 'Salvar Novo Token'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Cadastro de Novo Seller */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateSeller}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base text-slate-900">
                <Plus className="w-5 h-5 text-orange-600" />
                Adicionar Seller ao Monitor
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Cadastre um revendedor parceiro ou crie um seller de demonstração para testar KPIs.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 py-3 text-xs">
              <div className="space-y-1">
                <Label className="text-xs text-slate-700">Tipo de Seller</Label>
                <Select value={newSellerType} onValueChange={(v: any) => setNewSellerType(v)}>
                  <SelectTrigger className="text-xs h-9 bg-white border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="connected">Revendedor Parceiro Conectado</SelectItem>
                    <SelectItem value="demo">Demonstrativo (KPIs de Exemplo)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-slate-700">Apelido / Nome Fantasia *</Label>
                <Input
                  placeholder="Ex: TAY TECH, LOTE SUL INFORMÁTICA..."
                  value={newSellerNickname}
                  onChange={(e) => setNewSellerNickname(e.target.value)}
                  className="text-xs h-9"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-slate-700">ID do Vendedor no Mercado Livre *</Label>
                <Input
                  placeholder="Ex: 123456789 ou TAY_TECH_109"
                  value={newSellerId}
                  onChange={(e) => setNewSellerId(e.target.value)}
                  className="text-xs h-9 font-mono"
                  required
                />
              </div>

              {newSellerType === 'connected' && (
                <div className="space-y-1">
                  <Label className="text-xs text-slate-700">
                    Access Token ML (Opcional - para métricas privadas de vendas e perguntas)
                  </Label>
                  <Input
                    placeholder="APP_USR-..."
                    value={newSellerToken}
                    onChange={(e) => setNewSellerToken(e.target.value)}
                    className="text-xs h-9 font-mono"
                  />
                  <span className="text-[10px] text-slate-400">
                    Se omitido, monitoraremos somente dados públicos e reputação do catálogo.
                  </span>
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs text-slate-700">Observações / Anotações Internas</Label>
                <Textarea
                  placeholder="Ex: Comprador frequente de lotes de notebooks Dell Latitude 5420..."
                  value={newSellerNotes}
                  onChange={(e) => setNewSellerNotes(e.target.value)}
                  className="text-xs resize-none h-16"
                />
              </div>
            </div>

            <DialogFooter className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setCreateModalOpen(false)}
                className="text-xs h-8 text-slate-500"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={creating}
                className="bg-orange-600 hover:bg-orange-700 text-white text-xs h-8 font-bold"
              >
                {creating ? 'Salvando...' : 'Cadastrar Seller'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Detalhes Técnicos */}
      <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-slate-900">
              <Info className="w-5 h-5 text-blue-600" />
              Detalhes do Seller: {viewingSeller?.nickname}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Métricas detalhadas e histórico de sincronização com o Mercado Livre.
            </DialogDescription>
          </DialogHeader>

          {viewingSeller && (
            <div className="space-y-3.5 py-2 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    ID ML
                  </span>
                  <span className="font-mono font-bold text-slate-900">
                    {viewingSeller.seller_id}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Status Autenticação
                  </span>
                  <span className="font-bold text-slate-900">{viewingSeller.auth_status}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Total de Anúncios
                  </span>
                  <span className="font-bold text-slate-900">{viewingSeller.total_ads_count}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Tempo Médio Resposta
                  </span>
                  <span className="font-bold text-slate-900">
                    {viewingSeller.avg_response_time_minutes} minutos
                  </span>
                </div>
              </div>

              <div>
                <Label className="text-xs text-slate-700 block mb-1 font-bold">
                  Diagnóstico do Sistema:
                </Label>
                <div className="p-3 rounded-lg bg-slate-100 font-mono text-[11px] text-slate-700 break-words">
                  {viewingSeller.status_message}
                </div>
              </div>

              {viewingSeller.metrics_snapshot && (
                <div>
                  <Label className="text-xs text-slate-700 block mb-1 font-bold">
                    Snapshot de Métricas Recentes:
                  </Label>
                  <pre className="p-3 rounded-lg bg-slate-900 text-emerald-400 font-mono text-[10px] overflow-x-auto max-h-40">
                    {JSON.stringify(viewingSeller.metrics_snapshot, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              size="sm"
              onClick={() => setDetailsModalOpen(false)}
              className="text-xs h-8 bg-slate-900 text-white"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
