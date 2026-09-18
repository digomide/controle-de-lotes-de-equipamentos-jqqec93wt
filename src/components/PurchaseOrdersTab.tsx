import React, { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Boxes,
  Plus,
  Search,
  Filter,
  Calendar,
  DollarSign,
  Package,
  Layers,
  ArrowRight,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Loader2,
  Trash2,
  Edit2,
  ChevronRight,
  Sparkles,
  Edit3,
  ArrowUpDown,
  SlidersHorizontal,
  X,
  ExternalLink,
  MapPin,
} from 'lucide-react'
import { EditBatchModal } from '@/components/EditBatchModal'
import { DeletePurchaseBatchModal } from '@/components/DeletePurchaseBatchModal'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
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
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { useTenant } from '@/contexts/TenantContext'
import { useRealtime } from '@/hooks/use-realtime'
import { purchaseBatchesService } from '@/services/purchaseBatches'
import { productsService } from '@/services/products'
import type { PurchaseBatch, Product } from '@/types/inventory'

export function PurchaseOrdersTab() {
  const [batches, setBatches] = useState<PurchaseBatch[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  // Filters & Sorting
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateStartFilter, setDateStartFilter] = useState<string>('')
  const [dateEndFilter, setDateEndFilter] = useState<string>('')
  const [sortBy, setSortBy] = useState<
    'date_desc' | 'date_asc' | 'cost_desc' | 'cost_asc' | 'qty_desc' | 'supplier_asc'
  >('date_desc')

  // Modais de Criação, Edição e Exclusão
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [batchToEdit, setBatchToEdit] = useState<PurchaseBatch | null>(null)
  const [batchToDelete, setBatchToDelete] = useState<PurchaseBatch | null>(null)

  // Form State Novo Lote
  const [supplier, setSupplier] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().split('T')[0])
  const [totalCost, setTotalCost] = useState<number | string>('')
  const [expectedQuantity, setExpectedQuantity] = useState<number | string>('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { toast } = useToast()
  const { isAdmin } = useAuth()
  const { currentTenant } = useTenant()
  const navigate = useNavigate()

  const loadData = async () => {
    setLoading(true)
    try {
      const activeTenantId = currentTenant?.id
      const [batchData, prodData] = await Promise.all([
        purchaseBatchesService.getAll(activeTenantId),
        productsService.getAllByTenant(activeTenantId),
      ])
      setBatches(batchData)
      setProducts(prodData)
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao carregar pedidos de compra',
        description: 'Não foi possível carregar a listagem.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [currentTenant?.id])

  // Realtime subscription
  useRealtime<PurchaseBatch>('purchase_batches', () => {
    purchaseBatchesService.getAll(currentTenant?.id).then(setBatches)
  })

  // Map of inventoried products count per purchase_batch_id
  const batchStatsMap = useMemo(() => {
    const map = new Map<
      string,
      {
        count: number
        available: number
        sold: number
        reserved: number
        pending: number
        totalValue: number
      }
    >()
    products.forEach((p) => {
      if (p.purchase_batch_id) {
        const prev = map.get(p.purchase_batch_id) || {
          count: 0,
          available: 0,
          sold: 0,
          reserved: 0,
          pending: 0,
          totalValue: 0,
        }
        map.set(p.purchase_batch_id, {
          count: prev.count + 1,
          available: prev.available + (p.status === 'Disponível' ? 1 : 0),
          sold: prev.sold + (p.status === 'Vendido' ? 1 : 0),
          reserved: prev.reserved + (p.status === 'Reservado' ? 1 : 0),
          pending: prev.pending + (p.status === 'Pendente de ativação' ? 1 : 0),
          totalValue: prev.totalValue + (Number(p.unit_price) || 0),
        })
      }
    })
    return map
  }, [products])

  // Filtered and Sorted Batches
  const filteredBatches = useMemo(() => {
    return batches
      .filter((b) => {
        const q = searchTerm.toLowerCase().trim()
        const matchesSearch =
          !q ||
          b.supplier.toLowerCase().includes(q) ||
          (b.invoice_number && b.invoice_number.toLowerCase().includes(q)) ||
          (b.location && b.location.toLowerCase().includes(q)) ||
          (b.notes && b.notes.toLowerCase().includes(q)) ||
          b.id.toLowerCase().includes(q)

        const matchesStatus = statusFilter === 'all' || b.status === statusFilter

        // Period filter (purchase_date or created)
        const dateStr = b.purchase_date ? b.purchase_date.split('T')[0] : b.created.split('T')[0]
        const matchesStart = !dateStartFilter || dateStr >= dateStartFilter
        const matchesEnd = !dateEndFilter || dateStr <= dateEndFilter

        return matchesSearch && matchesStatus && matchesStart && matchesEnd
      })
      .sort((a, b) => {
        const dateA = new Date(a.purchase_date || a.created).getTime()
        const dateB = new Date(b.purchase_date || b.created).getTime()
        const costA = Number(a.total_cost) || 0
        const costB = Number(b.total_cost) || 0
        const qtyA = Number(a.expected_quantity) || 0
        const qtyB = Number(b.expected_quantity) || 0

        switch (sortBy) {
          case 'date_asc':
            return dateA - dateB
          case 'date_desc':
            return dateB - dateA
          case 'cost_desc':
            return costB - costA
          case 'cost_asc':
            return costA - costB
          case 'qty_desc':
            return qtyB - qtyA
          case 'supplier_asc':
            return a.supplier.localeCompare(b.supplier)
          default:
            return dateB - dateA
        }
      })
  }, [batches, searchTerm, statusFilter, dateStartFilter, dateEndFilter, sortBy])

  // Aggregate metrics
  const totalLotes = batches.length
  const lotesEmProcessamento = batches.filter((b) => b.status === 'em_processamento').length
  const lotesConcluidos = batches.filter((b) => b.status === 'concluido').length
  const totalInvestido = batches.reduce((acc, b) => acc + (Number(b.total_cost) || 0), 0)
  const totalEquipamentosEsperados = batches.reduce(
    (acc, b) => acc + (Number(b.expected_quantity) || 0),
    0,
  )
  const totalEquipamentosInventariados = batches.reduce((acc, b) => {
    const stats = batchStatsMap.get(b.id)
    return acc + (stats?.count || 0)
  }, 0)

  const hasActiveFilters =
    searchTerm !== '' || statusFilter !== 'all' || dateStartFilter !== '' || dateEndFilter !== ''

  const clearFilters = () => {
    setSearchTerm('')
    setStatusFilter('all')
    setDateStartFilter('')
    setDateEndFilter('')
    setSortBy('date_desc')
  }

  const handleOpenCreateModal = () => {
    setSupplier('')
    setInvoiceNumber(`NF-${Math.floor(100000 + Math.random() * 900000)}`)
    setPurchaseDate(new Date().toISOString().split('T')[0])
    setTotalCost('')
    setExpectedQuantity(10)
    setLocation('')
    setNotes('')
    setCreateModalOpen(true)
  }

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supplier.trim()) {
      toast({
        title: 'Fornecedor obrigatório',
        description: 'Informe o nome do fornecedor do pedido de compra.',
        variant: 'destructive',
      })
      return
    }

    const cost = Number(totalCost) || 0
    const qty = Number(expectedQuantity) || 1

    if (qty < 1) {
      toast({
        title: 'Quantidade inválida',
        description: 'A quantidade esperada deve ser no mínimo 1.',
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)
    try {
      const created = await purchaseBatchesService.create({
        supplier: supplier.trim(),
        invoice_number: invoiceNumber.trim() || undefined,
        purchase_date: purchaseDate
          ? new Date(purchaseDate).toISOString()
          : new Date().toISOString(),
        total_cost: cost,
        expected_quantity: qty,
        location: location.trim() || undefined,
        notes: notes.trim() || undefined,
        status: 'em_processamento',
        tenant_id: currentTenant?.id,
      })

      toast({
        title: 'Pedido de Compra cadastrado!',
        description: `Lote de ${supplier} com ${qty} equipamentos registrado com sucesso.`,
      })
      setCreateModalOpen(false)
      await loadData()
      navigate(`/lotes-entrada/${created.id}`)
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao cadastrar pedido de compra',
        description: err?.message || 'Falha ao salvar o novo pedido de compra.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenEdit = (e: React.MouseEvent, batch: PurchaseBatch) => {
    e.stopPropagation()
    setBatchToEdit(batch)
    setEditModalOpen(true)
  }

  const handleOpenDelete = (e: React.MouseEvent, batch: PurchaseBatch) => {
    e.stopPropagation()
    setBatchToDelete(batch)
    setDeleteModalOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Header com Ação Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200 mb-1.5">
            <Boxes className="w-3.5 h-3.5 text-orange-600" />
            Gestão de Pedidos de Compra & Lotes de Entrada
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Pedidos de Compra & Lotes de Aquisição
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Cadastro, edição, triagem, filtros e exclusão com segurança contábil para garantir
            consistência com estoques e vendas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleOpenCreateModal}
            className="bg-[#d9532f] hover:bg-[#c24624] text-white shadow-xs gap-1.5 text-xs font-bold h-9"
          >
            <Plus className="w-4 h-4" />
            Novo Pedido de Compra
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 shadow-xs bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Total de Pedidos
              </p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{totalLotes}</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {lotesEmProcessamento} em triagem • {lotesConcluidos} concluídos
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
              <Boxes className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-xs bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Custo Total Aquisições
              </p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">
                {totalInvestido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </h3>
              <p className="text-xs text-emerald-600 font-medium mt-0.5">
                Investimento em NF/pedidos
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-xs bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Equipamentos Triados
              </p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">
                {totalEquipamentosInventariados} / {totalEquipamentosEsperados}
              </h3>
              <div className="w-32 mt-1.5">
                <Progress
                  value={
                    totalEquipamentosEsperados > 0
                      ? Math.min(
                          100,
                          Math.round(
                            (totalEquipamentosInventariados / totalEquipamentosEsperados) * 100,
                          ),
                        )
                      : 0
                  }
                  className="h-1.5 bg-slate-100"
                />
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-xs bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Custo Médio Unitário
              </p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">
                {(totalEquipamentosEsperados > 0
                  ? totalInvestido / totalEquipamentosEsperados
                  : 0
                ).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Média por equipamento</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros e Busca Completa */}
      <Card className="border-slate-200 bg-white shadow-xs">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            {/* Busca textual */}
            <div className="relative sm:col-span-2 lg:col-span-2">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <Input
                placeholder="Buscar fornecedor, NF, local, observação..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-slate-50 border-slate-200 text-xs h-9"
              />
            </div>

            {/* Status */}
            <div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 bg-slate-50 border-slate-200 text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="em_processamento">Em processamento</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Período De */}
            <div>
              <Input
                type="date"
                value={dateStartFilter}
                onChange={(e) => setDateStartFilter(e.target.value)}
                placeholder="Data inicial"
                title="Data inicial da aquisição"
                className="h-9 bg-slate-50 border-slate-200 text-xs"
              />
            </div>

            {/* Período Até */}
            <div>
              <Input
                type="date"
                value={dateEndFilter}
                onChange={(e) => setDateEndFilter(e.target.value)}
                placeholder="Data final"
                title="Data final da aquisição"
                className="h-9 bg-slate-50 border-slate-200 text-xs"
              />
            </div>

            {/* Ordenação */}
            <div>
              <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
                <SelectTrigger className="h-9 bg-slate-50 border-slate-200 text-xs">
                  <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date_desc">Data (mais recente)</SelectItem>
                  <SelectItem value="date_asc">Data (mais antiga)</SelectItem>
                  <SelectItem value="cost_desc">Maior Custo Total</SelectItem>
                  <SelectItem value="cost_asc">Menor Custo Total</SelectItem>
                  <SelectItem value="qty_desc">Maior Quantidade</SelectItem>
                  <SelectItem value="supplier_asc">Fornecedor (A-Z)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Indicador de Filtros Ativos e Limpar */}
          {hasActiveFilters && (
            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 text-slate-500">
              <div className="flex items-center gap-2 flex-wrap">
                <span>Filtrando por:</span>
                {searchTerm && (
                  <Badge variant="outline" className="text-[10px] gap-1 bg-slate-100">
                    Termo: &quot;{searchTerm}&quot;
                  </Badge>
                )}
                {statusFilter !== 'all' && (
                  <Badge variant="outline" className="text-[10px] gap-1 bg-slate-100">
                    Status: {statusFilter === 'concluido' ? 'Concluído' : 'Em processamento'}
                  </Badge>
                )}
                {(dateStartFilter || dateEndFilter) && (
                  <Badge variant="outline" className="text-[10px] gap-1 bg-slate-100">
                    Período: {dateStartFilter || 'Início'} até {dateEndFilter || 'Fim'}
                  </Badge>
                )}
                <span className="font-semibold text-slate-700">
                  ({filteredBatches.length} de {batches.length} pedidos encontrados)
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 gap-1 p-1"
              >
                <X className="w-3.5 h-3.5" />
                Limpar Filtros
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista de Pedidos de Compra */}
      {loading ? (
        <div className="p-16 text-center bg-white rounded-xl border border-slate-200">
          <Loader2 className="w-8 h-8 animate-spin text-orange-600 mx-auto" />
          <p className="mt-3 text-sm text-slate-500">Carregando pedidos de compra...</p>
        </div>
      ) : filteredBatches.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200 bg-white">
          <CardContent className="py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center mx-auto mb-3">
              <Boxes className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              Nenhum pedido de compra encontrado
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              {hasActiveFilters
                ? 'Nenhum pedido coincide com os filtros aplicados. Tente ajustar os critérios de busca.'
                : 'Cadastre o primeiro pedido de compra para registrar fornecedores e abrir a triagem de estoque.'}
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              {hasActiveFilters && (
                <Button variant="outline" size="sm" onClick={clearFilters} className="text-xs">
                  Limpar Filtros
                </Button>
              )}
              <Button
                onClick={handleOpenCreateModal}
                className="bg-[#d9532f] hover:bg-[#c24624] text-white text-xs font-semibold"
                size="sm"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Novo Pedido de Compra
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Pedido / Fornecedor</th>
                  <th className="py-3 px-4">Data Aquisição</th>
                  <th className="py-3 px-4">Progresso de Triagem</th>
                  <th className="py-3 px-4">Status Estoque</th>
                  <th className="py-3 px-4 text-right">Custo Total</th>
                  <th className="py-3 px-4 text-right">Custo Unitário</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBatches.map((b) => {
                  const stats = batchStatsMap.get(b.id)
                  const inventariados = stats?.count || 0
                  const esperados = Number(b.expected_quantity) || 1
                  const pct = Math.min(100, Math.round((inventariados / esperados) * 100))
                  const custoMedio = (Number(b.total_cost) || 0) / esperados

                  return (
                    <tr
                      key={b.id}
                      onClick={() => navigate(`/lotes-entrada/${b.id}`)}
                      className="hover:bg-orange-50/40 transition-colors cursor-pointer group"
                    >
                      {/* Fornecedor / NF */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0 group-hover:bg-[#d9532f] group-hover:text-white transition-colors">
                            <Boxes className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 group-hover:text-[#d9532f] transition-colors text-sm">
                              {b.supplier}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5 flex-wrap">
                              {b.invoice_number ? (
                                <span className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-semibold">
                                  NF {b.invoice_number}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic">Sem NF</span>
                              )}
                              {b.location && (
                                <span className="text-slate-500 flex items-center gap-0.5">
                                  • <MapPin className="w-3 h-3 text-slate-400" />
                                  {b.location}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Data Aquisição */}
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {b.purchase_date
                              ? new Date(b.purchase_date).toLocaleDateString('pt-BR')
                              : new Date(b.created).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </td>

                      {/* Progresso Triagem */}
                      <td className="py-3.5 px-4 min-w-[160px]">
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="font-semibold text-slate-700">
                              {inventariados} de {esperados} un
                            </span>
                            <span
                              className={`font-bold ${
                                pct >= 100 ? 'text-emerald-600' : 'text-orange-600'
                              }`}
                            >
                              {pct}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                pct >= 100 ? 'bg-emerald-500' : 'bg-[#d9532f]'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Status Estoque (Disponíveis / Vendidos) */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <span
                            className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-semibold"
                            title="Equipamentos disponíveis no estoque"
                          >
                            {stats?.available || 0} disp.
                          </span>
                          {(stats?.sold || 0) > 0 && (
                            <span
                              className="text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded font-semibold"
                              title="Equipamentos já faturados / vendidos"
                            >
                              {stats?.sold} vend.
                            </span>
                          )}
                          {(stats?.pending || 0) > 0 && (
                            <span
                              className="text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-semibold"
                              title="Equipamentos pendentes de ativação"
                            >
                              {stats?.pending} pend.
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Custo Total */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                        {(Number(b.total_cost) || 0).toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </td>

                      {/* Custo Unitário */}
                      <td className="py-3.5 px-4 text-right font-mono text-slate-600 whitespace-nowrap">
                        {custoMedio.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </td>

                      {/* Status do Lote */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {b.status === 'concluido' ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-none font-semibold text-[10px] gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Concluído
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-800 border-none font-semibold text-[10px] gap-1">
                            <Clock className="w-3 h-3" />
                            Em processamento
                          </Badge>
                        )}
                      </td>

                      {/* Ações (Editar, Ver, Excluir) */}
                      <td
                        className="py-3.5 px-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleOpenEdit(e, b)}
                            className="h-8 w-8 p-0 text-slate-500 hover:text-orange-600 hover:bg-orange-50 rounded"
                            title="Editar Pedido de Compra"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </Button>

                          <Link
                            to={`/lotes-entrada/${b.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 rounded transition-colors"
                          >
                            Ver Lote
                            <ArrowRight className="w-3 h-3" />
                          </Link>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleOpenDelete(e, b)}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                            title="Excluir Pedido de Compra"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL NOVO PEDIDO DE COMPRA */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="sm:max-w-lg bg-white p-6 font-sans">
          <DialogHeader>
            <div className="w-10 h-10 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center mb-2">
              <Boxes className="w-5 h-5" />
            </div>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Novo Pedido de Compra
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Cadastre a compra ou arremate para habilitar a esteira de triagem e baixa no estoque.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateBatch} className="space-y-4 mt-2">
            <div>
              <Label htmlFor="tab-supplier" className="text-xs font-semibold text-slate-700">
                Fornecedor / Origem *
              </Label>
              <Input
                id="tab-supplier"
                placeholder="Ex: Dell Brasil Indústria Ltda, Leilão SP, BH Recicla"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="mt-1 text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="tab-invoice" className="text-xs font-semibold text-slate-700">
                  Número da Nota Fiscal (NF) / Lote
                </Label>
                <Input
                  id="tab-invoice"
                  placeholder="Ex: 310826"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="mt-1 font-mono text-xs"
                />
              </div>

              <div>
                <Label htmlFor="tab-pdate" className="text-xs font-semibold text-slate-700">
                  Data da Aquisição *
                </Label>
                <Input
                  id="tab-pdate"
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="mt-1 text-xs"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="tab-cost" className="text-xs font-semibold text-slate-700">
                  Custo Total de Aquisição (R$) *
                </Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-2 text-xs text-slate-400 font-semibold">
                    R$
                  </span>
                  <Input
                    id="tab-cost"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={totalCost}
                    onChange={(e) => setTotalCost(e.target.value)}
                    className="pl-9 text-xs"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="tab-qty" className="text-xs font-semibold text-slate-700">
                  Quantidade Total Esperada *
                </Label>
                <Input
                  id="tab-qty"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Ex: 20"
                  value={expectedQuantity}
                  onChange={(e) => setExpectedQuantity(e.target.value)}
                  className="mt-1 text-xs"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="tab-loc" className="text-xs font-semibold text-slate-700">
                  Localização Física / Armazém
                </Label>
                <Input
                  id="tab-loc"
                  placeholder="Ex: Sala Vendas, Prateleira B3"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <Label htmlFor="tab-notes" className="text-xs font-semibold text-slate-700">
                  Observações
                </Label>
                <Input
                  id="tab-notes"
                  placeholder="Anotações gerais..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>
            </div>

            {Number(totalCost) > 0 && Number(expectedQuantity) > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-xs text-slate-700 flex justify-between items-center">
                <span>Custo médio por item projetado:</span>
                <span className="font-bold text-[#d9532f] text-sm">
                  {(Number(totalCost) / Number(expectedQuantity)).toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </span>
              </div>
            )}

            <DialogFooter className="pt-2 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCreateModalOpen(false)}
                disabled={isSubmitting}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-[#d9532f] hover:bg-[#c24624] text-white text-xs font-bold"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Pedido e Triar'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL DE EDIÇÃO */}
      <EditBatchModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        batch={batchToEdit}
        onSuccess={() => {
          loadData()
        }}
      />

      {/* MODAL DE EXCLUSÃO SEGURA */}
      <DeletePurchaseBatchModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        batch={batchToDelete}
        onSuccess={() => {
          loadData()
        }}
      />
    </div>
  )
}
