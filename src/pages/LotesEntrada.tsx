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
import { purchaseBatchesService } from '@/services/purchaseBatches'
import { productsService } from '@/services/products'
import type { PurchaseBatch, Product } from '@/types/inventory'

export default function LotesEntrada() {
  const [batches, setBatches] = useState<PurchaseBatch[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateStartFilter, setDateStartFilter] = useState<string>('')
  const [dateEndFilter, setDateEndFilter] = useState<string>('')
  const [sortBy, setSortBy] = useState<
    'date_desc' | 'date_asc' | 'cost_desc' | 'cost_asc' | 'qty_desc' | 'supplier_asc'
  >('date_desc')

  // Modal Novo Lote
  const [createModalOpen, setCreateModalOpen] = useState(false)
  // Modal Editar Lote
  const [editBatchModalOpen, setEditBatchModalOpen] = useState(false)
  const [batchToEdit, setBatchToEdit] = useState<PurchaseBatch | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [batchToDelete, setBatchToDelete] = useState<PurchaseBatch | null>(null)
  const [supplier, setSupplier] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().split('T')[0])
  const [totalCost, setTotalCost] = useState<number | string>('')
  const [expectedQuantity, setExpectedQuantity] = useState<number | string>('')
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
        title: 'Erro ao carregar lotes de entrada',
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

  // Map of inventoried products count per purchase_batch_id
  const batchStatsMap = useMemo(() => {
    const map = new Map<string, { count: number; totalSold: number; totalValue: number }>()
    products.forEach((p) => {
      if (p.purchase_batch_id) {
        const prev = map.get(p.purchase_batch_id) || { count: 0, totalSold: 0, totalValue: 0 }
        map.set(p.purchase_batch_id, {
          count: prev.count + 1,
          totalSold: prev.totalSold + (p.status === 'Vendido' ? 1 : 0),
          totalValue: prev.totalValue + (Number(p.unit_price) || 0),
        })
      }
    })
    return map
  }, [products])

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
  const totalInvestido = batches.reduce((acc, b) => acc + (Number(b.total_cost) || 0), 0)
  const totalEquipamentosEsperados = batches.reduce(
    (acc, b) => acc + (Number(b.expected_quantity) || 0),
    0,
  )
  const totalEquipamentosInventariados = batches.reduce((acc, b) => {
    const stats = batchStatsMap.get(b.id)
    return acc + (stats?.count || 0)
  }, 0)

  const handleOpenCreateModal = () => {
    setSupplier('')
    setInvoiceNumber(`NF-${Math.floor(100000 + Math.random() * 900000)}`)
    setPurchaseDate(new Date().toISOString().split('T')[0])
    setTotalCost(15000)
    setExpectedQuantity(10)
    setCreateModalOpen(true)
  }

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supplier.trim()) {
      toast({
        title: 'Fornecedor obrigatório',
        description: 'Informe o nome do fornecedor do lote.',
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
        status: 'em_processamento',
        tenant_id: currentTenant?.id,
      })

      toast({
        title: 'Lote de Entrada criado com sucesso!',
        description: `Lote de ${supplier} com ${qty} equipamentos registrado.`,
      })
      setCreateModalOpen(false)
      await loadData()
      // Redireciona para o detalhe para iniciar o inventário
      navigate(`/lotes-entrada/${created.id}`)
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao cadastrar lote',
        description: err?.message || 'Falha ao salvar o novo lote de compras.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteBatch = (e: React.MouseEvent, batch: PurchaseBatch) => {
    e.stopPropagation()
    e.preventDefault()
    setBatchToDelete(batch)
    setDeleteModalOpen(true)
  }

  const hasActiveFilters =
    searchTerm !== '' || statusFilter !== 'all' || dateStartFilter !== '' || dateEndFilter !== ''

  const clearFilters = () => {
    setSearchTerm('')
    setStatusFilter('all')
    setDateStartFilter('')
    setDateEndFilter('')
    setSortBy('date_desc')
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Banner / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200 mb-2">
            <Boxes className="w-3.5 h-3.5 text-orange-600" />
            Fluxo de Entrada de Compras
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Compra de Lotes</h1>
          <p className="text-sm text-slate-500 mt-1">
            Gerencie compras de fornecedores, triagem de equipamentos e acompanhamento do custo por
            lote.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleOpenCreateModal}
            className="bg-[#d9532f] hover:bg-[#c24624] text-white shadow-sm gap-2 font-medium"
          >
            <Plus className="w-4 h-4" />
            Nova Compra de Lote
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 shadow-xs bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Total de Lotes
              </p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{totalLotes}</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {lotesEmProcessamento} em triagem ativa
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
              <p className="text-xs text-emerald-600 font-medium mt-0.5">Valor pago em NF/lotes</p>
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
                Progresso Geral Triagem
              </p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">
                {totalEquipamentosInventariados} / {totalEquipamentosEsperados}
              </h3>
              <div className="w-36 mt-1.5">
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
              <p className="text-xs text-slate-400 mt-0.5">Base global de aquisição</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search Bar */}
      <Card className="border-slate-200 bg-white shadow-xs">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="relative sm:col-span-2 lg:col-span-2">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <Input
                placeholder="Buscar fornecedor, NF, local ou anotação..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-slate-50 border-slate-200 text-xs h-9"
              />
            </div>
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
                className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
              >
                Limpar Filtros
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Batch List Table / Cards */}
      {loading ? (
        <div className="p-16 text-center bg-white rounded-xl border border-slate-200">
          <Loader2 className="w-8 h-8 animate-spin text-orange-600 mx-auto" />
          <p className="mt-3 text-sm text-slate-500">Carregando lotes de compras...</p>
        </div>
      ) : filteredBatches.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200 bg-white">
          <CardContent className="py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center mx-auto mb-4">
              <Boxes className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Nenhum lote de compra encontrado</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
              {searchTerm || statusFilter !== 'all'
                ? 'Tente ajustar os filtros ou termo de busca.'
                : 'Cadastre o primeiro lote de compras para registrar fornecedores e triar equipamentos.'}
            </p>
            <Button
              onClick={handleOpenCreateModal}
              className="mt-5 bg-[#d9532f] hover:bg-[#c24624] text-white"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Cadastrar Compra de Lote
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Lote / Fornecedor</th>
                  <th className="py-3.5 px-4">Progresso de Triagem</th>
                  <th className="py-3.5 px-4">Custo Total</th>
                  <th className="py-3.5 px-4">Custo Médio Sugerido</th>
                  <th className="py-3.5 px-4">Data da Compra</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBatches.map((b) => {
                  const stats = batchStatsMap.get(b.id)
                  const inventariados = stats?.count || 0
                  const esperados = Number(b.expected_quantity) || 1
                  const pct = Math.min(100, Math.round((inventariados / esperados) * 100))
                  const custoMedio = (Number(b.total_cost) || 0) / esperados
                  const isFinished = b.status === 'concluido' || inventariados >= esperados

                  return (
                    <tr
                      key={b.id}
                      onClick={() => navigate(`/lotes-entrada/${b.id}`)}
                      className="hover:bg-orange-50/40 transition-colors cursor-pointer group"
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-orange-100/70 text-orange-600 flex items-center justify-center flex-shrink-0 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                            <Boxes className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 group-hover:text-[#d9532f] transition-colors">
                              {b.supplier}
                            </div>
                            <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                              {b.invoice_number ? (
                                <span className="inline-flex items-center gap-1 font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                  NF: {b.invoice_number}
                                </span>
                              ) : (
                                <span className="text-slate-400">Sem NF</span>
                              )}
                              <span className="text-slate-300">•</span>
                              <span className="text-slate-400">ID: {b.id.slice(0, 8)}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4 min-w-[180px]">
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-semibold text-slate-800">
                              {inventariados} de {esperados}{' '}
                              <span className="text-slate-400 font-normal">inventariados</span>
                            </span>
                            <span
                              className={`font-semibold ${
                                pct >= 100 ? 'text-emerald-600' : 'text-orange-600'
                              }`}
                            >
                              {pct}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                pct >= 100 ? 'bg-emerald-500' : 'bg-[#d9532f]'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4 font-semibold text-slate-900">
                        {(Number(b.total_cost) || 0).toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </td>

                      <td className="py-4 px-4 font-medium text-slate-600">
                        {custoMedio.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                        <span className="text-xs text-slate-400 ml-1">/ un</span>
                      </td>

                      <td className="py-4 px-4 text-slate-600 text-xs">
                        {b.purchase_date
                          ? new Date(b.purchase_date).toLocaleDateString('pt-BR')
                          : new Date(b.created).toLocaleDateString('pt-BR')}
                      </td>

                      <td className="py-4 px-4">
                        {b.status === 'concluido' ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-none font-medium hover:bg-emerald-100 text-xs">
                            Concluído
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-800 border-none font-medium hover:bg-amber-100 text-xs">
                            Em processamento
                          </Badge>
                        )}
                      </td>

                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setBatchToEdit(b)
                              setEditBatchModalOpen(true)
                            }}
                            className="p-1.5 text-slate-500 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors"
                            title="Editar Lote"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          <Link
                            to={`/lotes-entrada/${b.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 rounded-md transition-colors"
                          >
                            Ver Lote
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteBatch(e, b)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                            title="Excluir Lote"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {/* Modal Cadastro de Lote (Baseado na Tela 2) */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="sm:max-w-lg bg-white p-6">
          <DialogHeader>
            <div className="w-10 h-10 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center mb-2">
              <Boxes className="w-5 h-5" />
            </div>
            <DialogTitle className="text-xl font-bold text-slate-900">
              Nova Compra de Lote
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              Informe os dados da nota ou compra para abrir a esteira de triagem de equipamentos.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateBatch} className="space-y-4 mt-2">
            <div>
              <Label htmlFor="supplier" className="text-xs font-semibold text-slate-700">
                Fornecedor / Origem *
              </Label>
              <Input
                id="supplier"
                placeholder="Ex: Dell Brasil Indústria Ltda ou Leilão SP"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="mt-1"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="invoice" className="text-xs font-semibold text-slate-700">
                  Número da Nota Fiscal (NF) / Lote
                </Label>
                <Input
                  id="invoice"
                  placeholder="Ex: 310826"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="mt-1 font-mono"
                />
              </div>

              <div>
                <Label htmlFor="pdate" className="text-xs font-semibold text-slate-700">
                  Data da Aquisição *
                </Label>
                <Input
                  id="pdate"
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="mt-1"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="cost" className="text-xs font-semibold text-slate-700">
                  Custo Total de Aquisição (R$) *
                </Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-semibold">
                    R$
                  </span>
                  <Input
                    id="cost"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={totalCost}
                    onChange={(e) => setTotalCost(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="qty" className="text-xs font-semibold text-slate-700">
                  Quantidade Total Esperada *
                </Label>
                <Input
                  id="qty"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Ex: 20"
                  value={expectedQuantity}
                  onChange={(e) => setExpectedQuantity(e.target.value)}
                  className="mt-1"
                  required
                />
              </div>
            </div>

            {Number(totalCost) > 0 && Number(expectedQuantity) > 0 && (
              <div className="bg-orange-50/70 border border-orange-200/60 rounded-lg p-3 text-xs text-slate-700">
                <div className="flex justify-between items-center font-medium">
                  <span>Custo-base unitário sugerido:</span>
                  <span className="font-bold text-[#d9532f] text-sm">
                    {(Number(totalCost) / Number(expectedQuantity)).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Este valor será pré-preenchido como custo sugerido em cada ficha de inventário.
                </p>
              </div>
            )}

            <DialogFooter className="pt-3 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-[#d9532f] hover:bg-[#c24624] text-white"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  'Salvar Lote e Triar'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Editar Lote Existente */}
      <EditBatchModal
        open={editBatchModalOpen}
        onOpenChange={setEditBatchModalOpen}
        batch={batchToEdit}
        onSuccess={() => {
          loadData()
        }}
      />

      {/* Modal Exclusão Segura */}
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
