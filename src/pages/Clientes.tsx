import React, { useState, useEffect, useMemo } from 'react'
import {
  Users,
  Search,
  Plus,
  RefreshCw,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Filter,
  DollarSign,
  ShoppingBag,
  Sparkles,
  Edit2,
  Trash2,
  MessageSquare,
  Award,
  Send,
  Building2,
  Check,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { mlCustomersService } from '@/services/mlCustomersService'
import { mlOrdersService, type MLOrder } from '@/services/mlOrdersService'
import type { MLCustomer, MLCustomerOrigin, CustomerNoteEntry } from '@/types/customers'

export default function Clientes() {
  const { toast } = useToast()
  const { user, isAdmin } = useAuth()

  const [customers, setCustomers] = useState<MLCustomer[]>([])
  const [orders, setOrders] = useState<MLOrder[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [search, setSearch] = useState('')
  const [originFilter, setOriginFilter] = useState<string>('all')
  const [recurringFilter, setRecurringFilter] = useState<string>('all')
  const [posVendaFilter, setPosVendaFilter] = useState<string>('all') // all | today_overdue | scheduled

  // Ficha do Cliente (Drawer / Sheet)
  const [selectedCustomer, setSelectedCustomer] = useState<MLCustomer | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [customerOrders, setCustomerOrders] = useState<MLOrder[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)

  // Edição na ficha do cliente
  const [isEditingContact, setIsEditingContact] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editDocument, setEditDocument] = useState('')

  // Nova anotação
  const [newNoteText, setNewNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  // Modal Novo Cliente Manual
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [manualName, setManualName] = useState('')
  const [manualPhone, setManualPhone] = useState('')
  const [manualEmail, setManualEmail] = useState('')
  const [manualDocument, setManualDocument] = useState('')
  const [manualAddress, setManualAddress] = useState('')
  const [manualNotes, setManualNotes] = useState('')
  const [manualContactDays, setManualContactDays] = useState<string>('none')
  const [creating, setCreating] = useState(false)

  // Carregar dados
  const loadData = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [custRes, ordRes] = await Promise.all([
        mlCustomersService.getCustomers({ perPage: 500 }),
        mlOrdersService.getOrders({ perPage: 500 }),
      ])
      setCustomers(custRes.items)
      setOrders(ordRes.items)
    } catch (err: any) {
      console.error('Erro ao carregar dados de clientes:', err)
      toast({
        title: 'Erro ao carregar clientes',
        description: err.message || 'Falha ao buscar ml_customers.',
        variant: 'destructive',
      })
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Agrupar pedidos por cliente para cálculo de métricas em tempo real
  const ordersByCustomer = useMemo(() => {
    const map = new Map<string, MLOrder[]>()
    for (const ord of orders) {
      const bId = ord.buyer_id
      const bNick = ord.buyer_nickname?.toLowerCase()

      if (bId) {
        if (!map.has(`id:${bId}`)) map.set(`id:${bId}`, [])
        map.get(`id:${bId}`)!.push(ord)
      }
      if (bNick) {
        if (!map.has(`nick:${bNick}`)) map.set(`nick:${bNick}`, [])
        map.get(`nick:${bNick}`)!.push(ord)
      }
    }
    return map
  }, [orders])

  const getCustomerMetrics = (c: MLCustomer) => {
    const ordersSet = new Set<string>()
    const matchedOrders: MLOrder[] = []

    if (c.buyer_id && ordersByCustomer.has(`id:${c.buyer_id}`)) {
      for (const ord of ordersByCustomer.get(`id:${c.buyer_id}`)!) {
        if (!ordersSet.has(ord.id)) {
          ordersSet.add(ord.id)
          matchedOrders.push(ord)
        }
      }
    }

    if (c.nickname && ordersByCustomer.has(`nick:${c.nickname.toLowerCase()}`)) {
      for (const ord of ordersByCustomer.get(`nick:${c.nickname.toLowerCase()}`)!) {
        if (!ordersSet.has(ord.id)) {
          ordersSet.add(ord.id)
          matchedOrders.push(ord)
        }
      }
    }

    const totalSpent = matchedOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0)
    const orderCount = matchedOrders.length
    const isRecurring = orderCount >= 2

    return {
      totalSpent,
      orderCount,
      isRecurring,
      matchedOrders,
    }
  }

  // Verificar status de retorno do pós-venda
  const getFollowUpStatus = (c: MLCustomer) => {
    if (!c.next_contact_date) return 'none'
    const contactTime = new Date(c.next_contact_date).getTime()
    const now = new Date()
    const endOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
    ).getTime()
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
    ).getTime()

    if (contactTime < startOfToday) {
      return 'overdue' // Em atraso
    }
    if (contactTime >= startOfToday && contactTime <= endOfToday) {
      return 'today' // Hoje
    }
    return 'scheduled' // Futuro agendado
  }

  // Filtragem da lista
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      // Origem
      if (originFilter !== 'all' && c.origin !== originFilter) return false

      const metrics = getCustomerMetrics(c)

      // Recorrente
      if (recurringFilter === 'recurring' && !metrics.isRecurring) return false
      if (recurringFilter === 'single' && metrics.isRecurring) return false

      // Pós-venda
      const followUp = getFollowUpStatus(c)
      if (posVendaFilter === 'today_overdue') {
        if (followUp !== 'today' && followUp !== 'overdue') return false
      } else if (posVendaFilter === 'scheduled') {
        if (followUp === 'none') return false
      }

      // Busca texto
      if (search.trim()) {
        const q = search.toLowerCase()
        const matchesName = c.name?.toLowerCase().includes(q)
        const matchesNick = c.nickname?.toLowerCase().includes(q)
        const matchesPhone = c.phone?.toLowerCase().includes(q)
        const matchesEmail = c.email?.toLowerCase().includes(q)
        const matchesDoc = c.document?.toLowerCase().includes(q)
        const matchesId = c.buyer_id?.toLowerCase().includes(q)

        if (
          !matchesName &&
          !matchesNick &&
          !matchesPhone &&
          !matchesEmail &&
          !matchesDoc &&
          !matchesId
        ) {
          return false
        }
      }

      return true
    })
  }, [customers, search, originFilter, recurringFilter, posVendaFilter, ordersByCustomer])

  // Contagens para os cards de topo
  const topStats = useMemo(() => {
    let totalClientes = customers.length
    let totalML = 0
    let totalManual = 0
    let recorrentes = 0
    let followUpHojeOuAtraso = 0

    for (const c of customers) {
      if (c.origin === 'ml') totalML++
      if (c.origin === 'manual') totalManual++
      const m = getCustomerMetrics(c)
      if (m.isRecurring) recorrentes++
      const fu = getFollowUpStatus(c)
      if (fu === 'today' || fu === 'overdue') followUpHojeOuAtraso++
    }

    return {
      totalClientes,
      totalML,
      totalManual,
      recorrentes,
      followUpHojeOuAtraso,
    }
  }, [customers, ordersByCustomer])

  // Abrir Ficha do Cliente
  const handleOpenCustomer = (customer: MLCustomer) => {
    setSelectedCustomer(customer)
    setEditName(customer.name || '')
    setEditPhone(customer.phone || '')
    setEditEmail(customer.email || '')
    setEditAddress(customer.address || '')
    setEditDocument(customer.document || '')
    setIsEditingContact(false)
    setNewNoteText('')

    const { matchedOrders } = getCustomerMetrics(customer)
    setCustomerOrders(matchedOrders)
    setDrawerOpen(true)
  }

  // Salvar Edição de Contato
  const handleSaveContactEdit = async () => {
    if (!selectedCustomer) return
    try {
      const updated = await mlCustomersService.updateCustomer(selectedCustomer.id, {
        name: editName.trim() || selectedCustomer.name,
        phone: editPhone.trim(),
        email: editEmail.trim(),
        address: editAddress.trim(),
        document: editDocument.trim(),
      })
      setSelectedCustomer(updated)
      setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      setIsEditingContact(false)
      toast({
        title: 'Dados atualizados',
        description: 'Informações de contato e endereço salvas com sucesso.',
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar',
        description: err.message || 'Não foi possível atualizar o cliente.',
        variant: 'destructive',
      })
    }
  }

  // Adicionar Anotação no Histórico
  const handleAddNote = async () => {
    if (!selectedCustomer || !newNoteText.trim()) return
    setSavingNote(true)
    try {
      const updated = await mlCustomersService.addNote(
        selectedCustomer.id,
        newNoteText,
        user?.name || 'Equipe Ambicorp',
      )
      setSelectedCustomer(updated)
      setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      setNewNoteText('')
      toast({
        title: 'Anotação salva',
        description: 'Nota registrada no histórico com autor e data.',
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao registrar anotação',
        description: err.message || 'Falha ao salvar nota.',
        variant: 'destructive',
      })
    } finally {
      setSavingNote(false)
    }
  }

  // Agendar Pós-Venda em X dias
  const handleScheduleDays = async (days: number) => {
    if (!selectedCustomer) return
    try {
      const updated = await mlCustomersService.scheduleContactInDays(selectedCustomer.id, days)
      setSelectedCustomer(updated)
      setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      toast({
        title: 'Pós-venda agendado',
        description: `Contato agendado para daqui a ${days} dias (${new Date(updated.next_contact_date!).toLocaleDateString('pt-BR')}).`,
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao agendar',
        description: err.message || 'Falha ao agendar retorno.',
        variant: 'destructive',
      })
    }
  }

  // Concluir pós-venda agendado
  const handleClearSchedule = async () => {
    if (!selectedCustomer) return
    try {
      const updated = await mlCustomersService.clearScheduledContact(selectedCustomer.id)
      setSelectedCustomer(updated)
      setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      toast({
        title: 'Pós-venda concluído',
        description: 'Retorno marcado como realizado.',
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao atualizar',
        description: err.message || 'Falha ao remover agendamento.',
        variant: 'destructive',
      })
    }
  }

  // Criar Cliente Manual
  const handleCreateManualCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualName.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Informe o nome do cliente para cadastrar.',
        variant: 'destructive',
      })
      return
    }

    setCreating(true)
    try {
      let nextContactIso: string | null = null
      if (manualContactDays !== 'none') {
        const days = parseInt(manualContactDays, 10)
        if (!isNaN(days) && days > 0) {
          nextContactIso = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
        }
      }

      const created = await mlCustomersService.createCustomer({
        name: manualName.trim(),
        phone: manualPhone.trim(),
        email: manualEmail.trim(),
        document: manualDocument.trim(),
        address: manualAddress.trim(),
        origin: 'manual',
        notes: manualNotes.trim(),
        next_contact_date: nextContactIso,
      })

      if (manualNotes.trim()) {
        await mlCustomersService.addNote(
          created.id,
          manualNotes.trim(),
          user?.name || 'Cadastro Manual',
        )
      }

      toast({
        title: 'Cliente cadastrado!',
        description: `${created.name} foi adicionado à base de clientes.`,
      })

      setCreateModalOpen(false)
      setManualName('')
      setManualPhone('')
      setManualEmail('')
      setManualDocument('')
      setManualAddress('')
      setManualNotes('')
      setManualContactDays('none')

      await loadData(true)
    } catch (err: any) {
      toast({
        title: 'Erro ao criar cliente',
        description: err.message || 'Falha ao salvar cliente.',
        variant: 'destructive',
      })
    } finally {
      setCreating(false)
    }
  }

  const formatCurrency = (val: number, currency = 'BRL') => {
    return Number(val || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: currency || 'BRL',
    })
  }

  const formatDate = (isoStr: string) => {
    if (!isoStr) return '-'
    const d = new Date(isoStr)
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const formatDateTime = (isoStr: string) => {
    if (!isoStr) return '-'
    const d = new Date(isoStr)
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-800 text-white shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">Clientes & Pós-Venda</h2>
              <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30 text-[10px] font-semibold">
                CRM AmbicorpFlow
              </Badge>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Base unificada de compradores Mercado Livre e revendedores manuais. Histórico de
              compras, notas e retornos programados.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button
            size="sm"
            onClick={() => loadData()}
            disabled={loading}
            variant="outline"
            className="text-xs h-9 bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 font-medium gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          <Button
            size="sm"
            onClick={() => setCreateModalOpen(true)}
            className="text-xs h-9 bg-orange-500 hover:bg-orange-600 text-white font-bold gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Cadastrar Cliente
          </Button>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total de Clientes */}
        <Card className="border-slate-200 shadow-xs bg-white">
          <CardContent className="p-4">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block flex items-center gap-1">
              <Users className="w-3 h-3 text-slate-500" /> Total na Base
            </span>
            <span className="text-2xl font-black text-slate-900 mt-1 block font-mono">
              {topStats.totalClientes}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              <strong>{topStats.totalML}</strong> Mercado Livre ·{' '}
              <strong>{topStats.totalManual}</strong> Manuais
            </span>
          </CardContent>
        </Card>

        {/* Recorrentes (>= 2 compras) */}
        <Card className="border-amber-200 bg-amber-50/30 shadow-xs">
          <CardContent className="p-4">
            <span className="text-[11px] uppercase tracking-wider text-amber-700 font-bold block flex items-center gap-1">
              <Award className="w-3 h-3 text-amber-600" /> Clientes Recorrentes
            </span>
            <span className="text-2xl font-black text-amber-800 mt-1 block font-mono">
              {topStats.recorrentes}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              Compraram 2 ou mais vezes
            </span>
          </CardContent>
        </Card>

        {/* Pós-Venda Hoje / Em Atraso */}
        <Card
          className={`shadow-xs cursor-pointer transition-all ${
            topStats.followUpHojeOuAtraso > 0
              ? 'border-rose-300 bg-rose-50/50 hover:bg-rose-50'
              : 'border-slate-200 bg-white'
          }`}
          onClick={() =>
            setPosVendaFilter(posVendaFilter === 'today_overdue' ? 'all' : 'today_overdue')
          }
        >
          <CardContent className="p-4">
            <span className="text-[11px] uppercase tracking-wider text-rose-700 font-bold block flex items-center gap-1">
              <Clock className="w-3 h-3 text-rose-600" /> Pós-Venda Hoje / Atraso
            </span>
            <span className="text-2xl font-black text-rose-700 mt-1 block font-mono">
              {topStats.followUpHojeOuAtraso}
            </span>
            <span className="text-[11px] text-rose-600 font-medium mt-0.5 block">
              {posVendaFilter === 'today_overdue'
                ? 'Filtro ativado (clique para limpar)'
                : 'Exige contato prioritário'}
            </span>
          </CardContent>
        </Card>

        {/* Pedidos ML Integrados */}
        <Card className="border-slate-200 shadow-xs bg-white">
          <CardContent className="p-4">
            <span className="text-[11px] uppercase tracking-wider text-blue-600 font-bold block flex items-center gap-1">
              <ShoppingBag className="w-3 h-3 text-blue-500" /> Pedidos no Sistema
            </span>
            <span className="text-2xl font-black text-blue-700 mt-1 block font-mono">
              {orders.length}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              Histórico sincronizado do ML
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Alerta de Retorno Prioritário (se houver) */}
      {topStats.followUpHojeOuAtraso > 0 && posVendaFilter !== 'today_overdue' && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between gap-3 text-xs text-rose-900 shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              Você tem <strong>{topStats.followUpHojeOuAtraso} cliente(s)</strong> com pós-venda
              agendado para hoje ou em atraso.
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPosVendaFilter('today_overdue')}
            className="text-xs h-7 bg-white border-rose-300 text-rose-700 hover:bg-rose-100 font-bold"
          >
            Ver quem contatar agora
          </Button>
        </div>
      )}

      {/* Barra de Filtros e Busca */}
      <Card className="border-slate-200 shadow-xs bg-white">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Buscar por nome, apelido ML, telefone, e-mail ou documento..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 text-xs h-9 bg-slate-50 border-slate-200 focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Origem */}
              <Select value={originFilter} onValueChange={setOriginFilter}>
                <SelectTrigger className="text-xs h-9 w-[130px] bg-slate-50 border-slate-200">
                  <SelectValue placeholder="Origem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as origens</SelectItem>
                  <SelectItem value="ml">Mercado Livre</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>

              {/* Recorrência */}
              <Select value={recurringFilter} onValueChange={setRecurringFilter}>
                <SelectTrigger className="text-xs h-9 w-[140px] bg-slate-50 border-slate-200">
                  <SelectValue placeholder="Frequência" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os clientes</SelectItem>
                  <SelectItem value="recurring">Recorrentes (≥2)</SelectItem>
                  <SelectItem value="single">Única compra (1)</SelectItem>
                </SelectContent>
              </Select>

              {/* Pós-Venda */}
              <Select value={posVendaFilter} onValueChange={setPosVendaFilter}>
                <SelectTrigger className="text-xs h-9 w-[160px] bg-slate-50 border-slate-200">
                  <SelectValue placeholder="Pós-Venda" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todo o pós-venda</SelectItem>
                  <SelectItem value="today_overdue">Hoje / Em Atraso</SelectItem>
                  <SelectItem value="scheduled">Com agendamento</SelectItem>
                </SelectContent>
              </Select>

              {(search ||
                originFilter !== 'all' ||
                recurringFilter !== 'all' ||
                posVendaFilter !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearch('')
                    setOriginFilter('all')
                    setRecurringFilter('all')
                    setPosVendaFilter('all')
                  }}
                  className="text-xs h-9 text-slate-600 hover:text-slate-900"
                >
                  Limpar
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Clientes */}
      {loading ? (
        <div className="p-16 text-center text-slate-400 space-y-3 bg-white rounded-xl border border-slate-200">
          <RefreshCw className="w-8 h-8 mx-auto animate-spin text-orange-500" />
          <p className="text-sm font-semibold text-slate-700">Carregando carteira de clientes...</p>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <Card className="border-dashed border-slate-300 shadow-none bg-slate-50/50">
          <CardContent className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center mx-auto">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 text-base">Nenhum cliente encontrado</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {customers.length === 0
                ? 'Nenhum cliente cadastrado ainda. Sincronize pedidos do Mercado Livre ou adicione clientes manualmente.'
                : 'Nenhum cliente atende aos filtros pesquisados.'}
            </p>
            <Button
              size="sm"
              onClick={() => setCreateModalOpen(true)}
              className="mt-2 text-xs bg-orange-500 hover:bg-orange-600 text-white font-bold"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Cadastrar Manualmente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-bold">Cliente</th>
                  <th className="py-3 px-4 font-bold">Origem</th>
                  <th className="py-3 px-4 font-bold">Contato & Endereço</th>
                  <th className="py-3 px-4 font-bold text-center">Compras</th>
                  <th className="py-3 px-4 font-bold text-right">Total Gasto</th>
                  <th className="py-3 px-4 font-bold">Pós-Venda / Retorno</th>
                  <th className="py-3 px-4 font-bold text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.map((cust) => {
                  const metrics = getCustomerMetrics(cust)
                  const followUp = getFollowUpStatus(cust)

                  return (
                    <tr
                      key={cust.id}
                      onClick={() => handleOpenCustomer(cust)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    >
                      {/* Cliente */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs uppercase border border-slate-200 shrink-0">
                            {cust.name?.slice(0, 2) || 'CL'}
                          </div>
                          <div className="min-w-0 max-w-[200px]">
                            <p className="font-bold text-slate-900 truncate flex items-center gap-1.5">
                              {cust.name}
                              {metrics.isRecurring && (
                                <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[9px] px-1 py-0 h-4 font-bold gap-0.5">
                                  <Award className="w-2.5 h-2.5 text-amber-600" />
                                  Recorrente
                                </Badge>
                              )}
                            </p>
                            {cust.nickname && (
                              <p className="text-[10px] text-slate-500 font-mono truncate">
                                @{cust.nickname}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Origem */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {cust.origin === 'ml' ? (
                          <Badge className="bg-yellow-100 text-yellow-900 border-yellow-300 text-[10px] font-semibold gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            Mercado Livre
                          </Badge>
                        ) : (
                          <Badge className="bg-slate-100 text-slate-700 border-slate-300 text-[10px] font-semibold gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                            Manual / Balcão
                          </Badge>
                        )}
                      </td>

                      {/* Contato & Endereço */}
                      <td className="py-3.5 px-4">
                        <div className="max-w-[240px] space-y-0.5">
                          {cust.phone ? (
                            <p className="text-slate-700 font-medium flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="font-mono text-[11px]">{cust.phone}</span>
                            </p>
                          ) : (
                            <p className="text-slate-400 text-[11px] italic">Sem telefone</p>
                          )}
                          {cust.address && (
                            <p className="text-[10px] text-slate-500 truncate flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">{cust.address}</span>
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Compras */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <Badge
                          variant="outline"
                          className={`font-mono text-xs font-bold ${
                            metrics.orderCount > 0 ? 'bg-slate-50 text-slate-900' : 'text-slate-400'
                          }`}
                        >
                          {metrics.orderCount} {metrics.orderCount === 1 ? 'pedido' : 'pedidos'}
                        </Badge>
                      </td>

                      {/* Total Gasto */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                        {metrics.totalSpent > 0 ? formatCurrency(metrics.totalSpent) : '-'}
                      </td>

                      {/* Pós-Venda / Retorno */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {followUp === 'overdue' && (
                          <Badge className="bg-rose-100 text-rose-800 border-rose-300 text-[10px] font-bold gap-1">
                            <AlertCircle className="w-3 h-3 text-rose-600" />
                            Atrasado ({formatDate(cust.next_contact_date!)})
                          </Badge>
                        )}
                        {followUp === 'today' && (
                          <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] font-bold gap-1 animate-pulse">
                            <Clock className="w-3 h-3 text-amber-700" />
                            Contatar Hoje!
                          </Badge>
                        )}
                        {followUp === 'scheduled' && (
                          <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-medium gap-1">
                            <Calendar className="w-3 h-3 text-blue-500" />
                            Retorno em {formatDate(cust.next_contact_date!)}
                          </Badge>
                        )}
                        {followUp === 'none' && (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Ação */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenCustomer(cust)
                          }}
                          className="text-xs h-7 px-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50 font-semibold"
                        >
                          Abrir Ficha
                          <ChevronRight className="w-3 h-3 ml-0.5" />
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          FICHA DO CLIENTE (DRAWER / SHEET LATERAL)
          ========================================================================= */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="sm:max-w-2xl w-full p-0 flex flex-col bg-white">
          {selectedCustomer && (
            <>
              {/* Header da Ficha */}
              <div className="p-5 border-b border-slate-200 bg-slate-50/70">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-slate-900">{selectedCustomer.name}</h3>
                      {selectedCustomer.origin === 'ml' ? (
                        <Badge className="bg-yellow-100 text-yellow-900 border-yellow-300 text-[10px]">
                          Mercado Livre
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-700 border-slate-300 text-[10px]">
                          Manual
                        </Badge>
                      )}
                    </div>
                    {selectedCustomer.nickname && (
                      <p className="text-xs text-slate-500 font-mono mt-0.5">
                        Usuário ML: @{selectedCustomer.nickname} (ID:{' '}
                        {selectedCustomer.buyer_id || '-'})
                      </p>
                    )}
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-slate-500 uppercase tracking-wider block font-bold">
                      Total Comprado
                    </span>
                    <span className="text-xl font-black font-mono text-emerald-700 block">
                      {formatCurrency(getCustomerMetrics(selectedCustomer).totalSpent)}
                    </span>
                  </div>
                </div>

                {/* Badges de Destaque */}
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  {getCustomerMetrics(selectedCustomer).isRecurring && (
                    <Badge className="bg-amber-500 text-slate-950 font-bold text-xs gap-1">
                      <Award className="w-3.5 h-3.5" />
                      Cliente Recorrente ({getCustomerMetrics(selectedCustomer).orderCount} compras)
                    </Badge>
                  )}

                  {getFollowUpStatus(selectedCustomer) === 'today' && (
                    <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-bold text-xs gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-700" />
                      Pós-Venda Agendado para Hoje
                    </Badge>
                  )}

                  {getFollowUpStatus(selectedCustomer) === 'overdue' && (
                    <Badge className="bg-rose-100 text-rose-800 border-rose-300 font-bold text-xs gap-1">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                      Pós-Venda em Atraso ({formatDate(selectedCustomer.next_contact_date!)})
                    </Badge>
                  )}
                </div>
              </div>

              {/* Corpo da Ficha (Scrollável) */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {/* 1. Dados de Contato & Endereço */}
                <Card className="border-slate-200 shadow-xs">
                  <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-600" /> Dados de Contato & Endereço
                    </CardTitle>
                    {!isEditingContact ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setIsEditingContact(true)}
                        className="text-xs h-7 text-slate-600 hover:text-slate-900 gap-1"
                      >
                        <Edit2 className="w-3 h-3" /> Editar
                      </Button>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setIsEditingContact(false)}
                          className="text-xs h-7 text-slate-500"
                        >
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSaveContactEdit}
                          className="text-xs h-7 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                        >
                          Salvar
                        </Button>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="p-4 pt-2 text-xs space-y-2">
                    {isEditingContact ? (
                      <div className="space-y-3">
                        <div>
                          <label className="text-[11px] font-medium text-slate-600 block mb-1">
                            Nome Completo
                          </label>
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[11px] font-medium text-slate-600 block mb-1">
                              Telefone / WhatsApp
                            </label>
                            <Input
                              value={editPhone}
                              onChange={(e) => setEditPhone(e.target.value)}
                              placeholder="(11) 99999-9999"
                              className="h-8 text-xs font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-medium text-slate-600 block mb-1">
                              E-mail
                            </label>
                            <Input
                              value={editEmail}
                              onChange={(e) => setEditEmail(e.target.value)}
                              placeholder="cliente@email.com"
                              className="h-8 text-xs"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-slate-600 block mb-1">
                            CPF / CNPJ
                          </label>
                          <Input
                            value={editDocument}
                            onChange={(e) => setEditDocument(e.target.value)}
                            placeholder="Documento"
                            className="h-8 text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-slate-600 block mb-1">
                            Endereço Completo de Entrega
                          </label>
                          <Textarea
                            value={editAddress}
                            onChange={(e) => setEditAddress(e.target.value)}
                            rows={2}
                            placeholder="Rua, número, complemento, bairro, cidade - UF, CEP"
                            className="text-xs resize-none"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1.5 text-slate-700">
                        <p className="flex items-center gap-2">
                          <span className="font-semibold text-slate-500 w-20">Telefone:</span>
                          <span className="font-mono text-slate-900">
                            {selectedCustomer.phone || (
                              <span className="text-slate-400 italic">Não informado</span>
                            )}
                          </span>
                        </p>
                        <p className="flex items-center gap-2">
                          <span className="font-semibold text-slate-500 w-20">E-mail:</span>
                          <span className="text-slate-900">
                            {selectedCustomer.email || (
                              <span className="text-slate-400 italic">Não informado</span>
                            )}
                          </span>
                        </p>
                        <p className="flex items-center gap-2">
                          <span className="font-semibold text-slate-500 w-20">Documento:</span>
                          <span className="font-mono text-slate-900">
                            {selectedCustomer.document || (
                              <span className="text-slate-400 italic">Não informado</span>
                            )}
                          </span>
                        </p>
                        <p className="flex items-start gap-2 pt-1 border-t border-slate-100">
                          <span className="font-semibold text-slate-500 w-20 shrink-0">
                            Endereço:
                          </span>
                          <span className="text-slate-900">
                            {selectedCustomer.address || (
                              <span className="text-slate-400 italic">Endereço não informado</span>
                            )}
                          </span>
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 2. Pós-Venda: Agendamento de Retorno */}
                <Card className="border-amber-200 bg-amber-50/20 shadow-xs">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-600" /> Ação de Pós-Venda
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-2 text-xs space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <p className="text-slate-700 font-medium">Data de retorno programada:</p>
                        <p className="text-slate-900 font-bold font-mono text-sm mt-0.5">
                          {selectedCustomer.next_contact_date
                            ? formatDate(selectedCustomer.next_contact_date)
                            : 'Nenhum contato agendado'}
                        </p>
                      </div>

                      {selectedCustomer.next_contact_date && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleClearSchedule}
                          className="text-xs h-7 border-emerald-300 text-emerald-800 hover:bg-emerald-100 font-semibold gap-1"
                        >
                          <Check className="w-3 h-3" />
                          Marcar como Contatado
                        </Button>
                      )}
                    </div>

                    <div className="pt-2 border-t border-amber-200/60">
                      <span className="text-[11px] font-semibold text-slate-600 block mb-1.5">
                        Agendar próximo contato em:
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleScheduleDays(3)}
                          className="text-xs h-7 bg-white hover:bg-amber-100 border-amber-300 text-amber-950 font-medium"
                        >
                          +3 dias
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleScheduleDays(7)}
                          className="text-xs h-7 bg-white hover:bg-amber-100 border-amber-300 text-amber-950 font-medium"
                        >
                          +7 dias (1 semana)
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleScheduleDays(15)}
                          className="text-xs h-7 bg-white hover:bg-amber-100 border-amber-300 text-amber-950 font-medium"
                        >
                          +15 dias
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleScheduleDays(30)}
                          className="text-xs h-7 bg-white hover:bg-amber-100 border-amber-300 text-amber-950 font-medium"
                        >
                          +30 dias (1 mês)
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 3. Histórico de Anotações & CRM */}
                <Card className="border-slate-200 shadow-xs">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-slate-600" /> Histórico de
                      Anotações ({selectedCustomer.notes_history?.length || 0})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-2 text-xs space-y-3">
                    {/* Input nova anotação */}
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Escreva uma observação (ex.: cliente perguntou sobre notebook i7, pediu garantia estendida, confirmou recebimento)..."
                        value={newNoteText}
                        onChange={(e) => setNewNoteText(e.target.value)}
                        rows={2}
                        className="text-xs resize-none"
                      />
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          onClick={handleAddNote}
                          disabled={!newNoteText.trim() || savingNote}
                          className="text-xs h-7 bg-slate-900 hover:bg-slate-800 text-white font-bold gap-1"
                        >
                          <Send className="w-3 h-3" />
                          {savingNote ? 'Salvando...' : 'Registrar Nota'}
                        </Button>
                      </div>
                    </div>

                    {/* Timeline de notas */}
                    <div className="space-y-2 pt-2 border-t border-slate-100 max-h-48 overflow-y-auto">
                      {selectedCustomer.notes_history &&
                      selectedCustomer.notes_history.length > 0 ? (
                        selectedCustomer.notes_history.map((note, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1"
                          >
                            <div className="flex items-center justify-between text-[10px] text-slate-400">
                              <span className="font-semibold text-slate-700">{note.author}</span>
                              <span className="font-mono">{formatDateTime(note.date)}</span>
                            </div>
                            <p className="text-slate-800 text-xs whitespace-pre-wrap">
                              {note.text}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-slate-400 text-center py-2 italic text-xs">
                          Nenhuma anotação registrada ainda.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* 4. Compras Vinculadas ao Cliente */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <ShoppingBag className="w-3.5 h-3.5 text-slate-600" /> Histórico de Pedidos (
                      {customerOrders.length})
                    </h4>
                    <span className="text-xs font-mono font-bold text-slate-700">
                      Qtd: {customerOrders.length}
                    </span>
                  </div>

                  {customerOrders.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-xs">
                      Nenhum pedido do Mercado Livre vinculado diretamente a este comprador.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 overflow-hidden bg-white">
                      {customerOrders.map((ord) => (
                        <div
                          key={ord.id}
                          className="p-3 text-xs space-y-1.5 hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-slate-900">
                              Pedido #{ord.order_id}
                            </span>
                            <span className="font-mono font-bold text-emerald-700">
                              {formatCurrency(ord.total_amount, ord.currency_id)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span>{formatDate(ord.date_created)}</span>
                            <div className="flex items-center gap-1.5">
                              <Badge variant="outline" className="text-[10px] uppercase font-bold">
                                {ord.status === 'paid' ? 'Pago' : ord.status}
                              </Badge>
                              <Badge
                                className={`text-[10px] font-medium ${
                                  ord.shipping_status === 'delivered'
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {ord.shipping_status === 'delivered'
                                  ? 'Entregue'
                                  : ord.shipping_status}
                              </Badge>
                            </div>
                          </div>

                          {/* Itens comprados */}
                          {ord.items && ord.items.length > 0 && (
                            <div className="pt-1 text-[11px] text-slate-600">
                              {ord.items.map((it, i) => (
                                <p key={i} className="truncate">
                                  • {it.quantity}x {it.title} ({formatCurrency(it.unit_price)})
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* =========================================================================
          MODAL DE CADASTRO MANUAL DE CLIENTE
          ========================================================================= */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleCreateManualCustomer}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-orange-500" />
                Cadastrar Novo Cliente Manual
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Adicione compradores de lotes corporativos, revendedores ou clientes de balcão fora
                do Mercado Livre.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Nome do Cliente / Empresa *
                </label>
                <Input
                  required
                  placeholder="Ex: João Silva ou ABC Informática Ltda"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Telefone / WhatsApp
                  </label>
                  <Input
                    placeholder="(11) 98765-4321"
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value)}
                    className="h-9 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    E-mail
                  </label>
                  <Input
                    placeholder="contato@empresa.com"
                    value={manualEmail}
                    onChange={(e) => setManualEmail(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  CPF / CNPJ
                </label>
                <Input
                  placeholder="000.000.000-00 ou 00.000.000/0001-00"
                  value={manualDocument}
                  onChange={(e) => setManualDocument(e.target.value)}
                  className="h-9 text-xs font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Endereço
                </label>
                <Input
                  placeholder="Rua, número, cidade, UF, CEP"
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Programar Retorno (Pós-Venda)
                  </label>
                  <Select value={manualContactDays} onValueChange={setManualContactDays}>
                    <SelectTrigger className="text-xs h-9">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Não agendar</SelectItem>
                      <SelectItem value="3">Em 3 dias</SelectItem>
                      <SelectItem value="7">Em 7 dias (1 semana)</SelectItem>
                      <SelectItem value="15">Em 15 dias</SelectItem>
                      <SelectItem value="30">Em 30 dias (1 mês)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Observações Iniciais
                </label>
                <Textarea
                  placeholder="Interesse em compra de lotes de notebook, revendedor da região, etc..."
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  rows={2}
                  className="text-xs resize-none"
                />
              </div>
            </div>

            <DialogFooter className="border-t border-slate-100 pt-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setCreateModalOpen(false)}
                className="text-xs h-8 text-slate-600"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={creating}
                className="text-xs h-8 bg-orange-500 hover:bg-orange-600 text-white font-bold"
              >
                {creating ? 'Salvando...' : 'Cadastrar Cliente'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
