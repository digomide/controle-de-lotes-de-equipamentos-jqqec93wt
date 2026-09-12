import React, { useState, useEffect, useMemo } from 'react'
import {
  Boxes,
  Plus,
  Search,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  SlidersHorizontal,
  History,
  Trash2,
  Edit2,
  Loader2,
  PackageCheck,
  DollarSign,
  TrendingUp,
  MapPin,
  FileText,
  Filter,
  CheckCircle2,
  X,
  RefreshCw,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { useRealtime } from '@/hooks/use-realtime'
import {
  generalInventoryService,
  type CreateGeneralInventoryItemInput,
  type UpdateGeneralInventoryItemInput,
} from '@/services/generalInventory'
import {
  GENERAL_INVENTORY_CATEGORIES,
  type GeneralInventoryItem,
  type GeneralInventoryMovement,
  type GeneralInventoryMovementType,
} from '@/types/generalInventory'

export default function EstoqueGeral() {
  const [items, setItems] = useState<GeneralInventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const { isAdmin } = useAuth()

  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'low' | 'zero' | 'ok'>('all')

  // Modal Item (Novo ou Edição)
  const [itemModalOpen, setItemModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<GeneralInventoryItem | null>(null)
  const [formData, setFormData] = useState({
    description: '',
    category: 'Memória',
    customCategory: '',
    quantity: 0,
    cost_price: 0,
    suggested_price: 0,
    min_stock: 5,
    location: '',
    notes: '',
  })
  const [isSubmittingItem, setIsSubmittingItem] = useState(false)

  // Modal de Movimentação Rápida (Entrada / Saída / Ajuste)
  const [movementModalOpen, setMovementModalOpen] = useState(false)
  const [movementTargetItem, setMovementTargetItem] = useState<GeneralInventoryItem | null>(null)
  const [movementType, setMovementType] = useState<GeneralInventoryMovementType>('entrada')
  const [movementQty, setMovementQty] = useState<number>(1)
  const [movementUnitCost, setMovementUnitCost] = useState<number>(0)
  const [movementReason, setMovementReason] = useState('')
  const [movementObs, setMovementObs] = useState('')
  const [physicalCountVal, setPhysicalCountVal] = useState<number>(0)
  const [isSubmittingMovement, setIsSubmittingMovement] = useState(false)

  // Drawer de Histórico do Item
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false)
  const [historyItem, setHistoryItem] = useState<GeneralInventoryItem | null>(null)
  const [historyMovements, setHistoryMovements] = useState<GeneralInventoryMovement[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Carregar dados
  const loadData = async () => {
    try {
      setLoading(true)
      const data = await generalInventoryService.getAllItems()
      // Filtra de forma resiliente registros válidos para não quebrar a tela caso algum esteja malformado
      const validItems = (Array.isArray(data) ? data : []).filter(
        (it) => it && typeof it === 'object' && typeof it.id === 'string' && it.description,
      )
      setItems(validItems)
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao carregar estoque',
        description: err?.message || 'Falha ao buscar itens do estoque geral.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Atualização em tempo real via PocketBase
  useRealtime<GeneralInventoryItem>('general_inventory_items', () => {
    generalInventoryService
      .getAllItems()
      .then((data) => {
        const validItems = (Array.isArray(data) ? data : []).filter(
          (it) => it && typeof it === 'object' && typeof it.id === 'string' && it.description,
        )
        setItems(validItems)
      })
      .catch((err) => {
        console.error('[EstoqueGeral] Erro no realtime refresh:', err)
      })
  })

  // Categorias disponíveis (padrões + existentes no banco)
  const availableCategories = useMemo(() => {
    const set = new Set<string>(GENERAL_INVENTORY_CATEGORIES)
    items.forEach((item) => {
      if (item.category) set.add(item.category)
    })
    return Array.from(set).sort()
  }, [items])

  // KPIs
  const kpis = useMemo(() => {
    let totalItemsCount = 0
    let totalUnits = 0
    let totalInventoryValue = 0 // quantidade × custo
    let totalPotentialRevenue = 0 // quantidade × preco sugerido
    let lowStockCount = 0
    let zeroStockCount = 0

    items.forEach((item) => {
      if (!item) return
      const qty = Number(item.quantity) || 0
      const cost = Number(item.cost_price) || 0
      const price = Number(item.suggested_price) || 0
      const minStock = Number(item.min_stock) || 0

      totalItemsCount += 1
      totalUnits += qty
      totalInventoryValue += qty * cost
      totalPotentialRevenue += qty * price

      if (qty === 0) {
        zeroStockCount += 1
        lowStockCount += 1
      } else if (qty <= minStock) {
        lowStockCount += 1
      }
    })

    return {
      totalItemsCount,
      totalUnits,
      totalInventoryValue,
      totalPotentialRevenue,
      lowStockCount,
      zeroStockCount,
    }
  }, [items])

  // Filtragem
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (!item) return false
      const term = searchTerm.toLowerCase().trim()
      const description = (item.description || '').toLowerCase()
      const category = (item.category || '').toLowerCase()
      const location = (item.location || '').toLowerCase()
      const notes = (item.notes || '').toLowerCase()

      const matchesSearch =
        !term ||
        description.includes(term) ||
        category.includes(term) ||
        location.includes(term) ||
        notes.includes(term)

      const matchesCat = selectedCategory === 'all' || item.category === selectedCategory

      let matchesStock = true
      const qty = Number(item.quantity) || 0
      const minStock = Number(item.min_stock) || 0

      if (stockStatusFilter === 'low') {
        matchesStock = qty <= minStock
      } else if (stockStatusFilter === 'zero') {
        matchesStock = qty === 0
      } else if (stockStatusFilter === 'ok') {
        matchesStock = qty > minStock
      }

      return matchesSearch && matchesCat && matchesStock
    })
  }, [items, searchTerm, selectedCategory, stockStatusFilter])

  // Abrir Modal de Novo Item
  const handleOpenCreateItem = () => {
    setEditingItem(null)
    setFormData({
      description: '',
      category: 'Memória',
      customCategory: '',
      quantity: 0,
      cost_price: 0,
      suggested_price: 0,
      min_stock: 5,
      location: '',
      notes: '',
    })
    setItemModalOpen(true)
  }

  // Abrir Modal de Edição
  const handleOpenEditItem = (item: GeneralInventoryItem) => {
    setEditingItem(item)
    const isStandardCat = GENERAL_INVENTORY_CATEGORIES.includes(item.category as any)
    setFormData({
      description: item.description,
      category: isStandardCat ? item.category : 'Outra (Personalizada)',
      customCategory: isStandardCat ? '' : item.category,
      quantity: item.quantity,
      cost_price: item.cost_price,
      suggested_price: item.suggested_price,
      min_stock: item.min_stock,
      location: item.location || '',
      notes: item.notes || '',
    })
    setItemModalOpen(true)
  }

  // Salvar Item (Criar ou Atualizar)
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.description.trim()) {
      toast({
        title: 'Atenção',
        description: 'Informe a descrição do item.',
        variant: 'destructive',
      })
      return
    }

    const finalCategory =
      formData.category === 'Outra (Personalizada)'
        ? formData.customCategory.trim() || 'Diversos'
        : formData.category

    setIsSubmittingItem(true)
    try {
      if (editingItem) {
        const updateData: UpdateGeneralInventoryItemInput = {
          description: formData.description,
          category: finalCategory,
          cost_price: Number(formData.cost_price) || 0,
          suggested_price: Number(formData.suggested_price) || 0,
          min_stock: Number(formData.min_stock) || 0,
          location: formData.location,
          notes: formData.notes,
        }
        await generalInventoryService.updateItem(editingItem.id, updateData)
        toast({
          title: 'Item atualizado',
          description: `"${formData.description}" foi salvo com sucesso.`,
        })
      } else {
        const createData: CreateGeneralInventoryItemInput = {
          description: formData.description,
          category: finalCategory,
          quantity: Number(formData.quantity) || 0,
          cost_price: Number(formData.cost_price) || 0,
          suggested_price: Number(formData.suggested_price) || 0,
          min_stock: Number(formData.min_stock) || 0,
          location: formData.location,
          notes: formData.notes,
        }
        await generalInventoryService.createItem(createData)
        toast({
          title: 'Item cadastrado',
          description: `Novo item "${formData.description}" adicionado com sucesso.`,
        })
      }
      setItemModalOpen(false)
      await loadData()
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao salvar item',
        description: err?.message || 'Falha ao salvar no banco de dados.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmittingItem(false)
    }
  }

  // Excluir Item
  const handleDeleteItem = async (item: GeneralInventoryItem) => {
    if (
      !window.confirm(
        `Deseja realmente excluir o item "${item.description}"? O histórico de movimentações também será excluído.`,
      )
    ) {
      return
    }

    try {
      await generalInventoryService.deleteItem(item.id)
      toast({
        title: 'Item removido',
        description: `"${item.description}" foi excluído do estoque geral.`,
      })
      await loadData()
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao excluir item',
        description: err?.message || 'Apenas administradores podem excluir itens.',
        variant: 'destructive',
      })
    }
  }

  // Abrir Modal de Movimentação Direta
  const handleOpenMovementModal = (
    item: GeneralInventoryItem,
    type: GeneralInventoryMovementType,
  ) => {
    setMovementTargetItem(item)
    setMovementType(type)
    setMovementQty(1)
    setMovementUnitCost(item.cost_price || 0)
    setPhysicalCountVal(item.quantity)
    setMovementReason(
      type === 'entrada'
        ? 'Compra / Reposição de estoque'
        : type === 'saida'
          ? 'Uso em bancada / Manutenção'
          : 'Contagem física periódica',
    )
    setMovementObs('')
    setMovementModalOpen(true)
  }

  // Registrar Movimentação
  const handleSaveMovement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!movementTargetItem) return

    setIsSubmittingMovement(true)
    try {
      if (movementType === 'ajuste') {
        await generalInventoryService.registerMovement({
          item_id: movementTargetItem.id,
          type: 'ajuste',
          quantity: Math.abs(physicalCountVal - movementTargetItem.quantity),
          physical_count: physicalCountVal,
          reason: movementReason.trim() || 'Ajuste de inventário',
          observation: movementObs.trim(),
        })
      } else {
        await generalInventoryService.registerMovement({
          item_id: movementTargetItem.id,
          type: movementType,
          quantity: movementQty,
          unit_cost: movementType === 'entrada' ? movementUnitCost : undefined,
          reason: movementReason.trim(),
          observation: movementObs.trim(),
        })
      }

      toast({
        title:
          movementType === 'entrada'
            ? 'Entrada registrada com sucesso!'
            : movementType === 'saida'
              ? 'Saída registrada com sucesso!'
              : 'Ajuste de estoque concluído!',
        description: `Item "${movementTargetItem.description}" atualizado.`,
      })

      setMovementModalOpen(false)
      await loadData()
      // Se o histórico estiver aberto pro mesmo item, recarregar
      if (historyDrawerOpen && historyItem?.id === movementTargetItem.id) {
        handleOpenHistory(movementTargetItem)
      }
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro na movimentação',
        description: err?.message || 'Não foi possível registrar o lançamento.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmittingMovement(false)
    }
  }

  // Abrir Histórico do Item
  const handleOpenHistory = async (item: GeneralInventoryItem) => {
    setHistoryItem(item)
    setHistoryDrawerOpen(true)
    setLoadingHistory(true)
    try {
      const movs = await generalInventoryService.getMovementsByItem(item.id)
      const validMovs = (Array.isArray(movs) ? movs : []).filter(
        (m) => m && typeof m === 'object' && typeof m.id === 'string',
      )
      setHistoryMovements(validMovs)
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao carregar histórico',
        description: err?.message || 'Falha ao buscar movimentações.',
        variant: 'destructive',
      })
    } finally {
      setLoadingHistory(false)
    }
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val || 0)
  }

  const formatDate = (isoDate: string) => {
    if (!isoDate) return '-'
    const d = new Date(isoDate)
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
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Estoque Geral</h1>
            <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300">
              Peças & Acessórios
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Controle unificado e independente para memórias, SSDs, monitores, fontes, carcaças e
            periféricos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="text-slate-600 border-slate-300 hover:bg-slate-100"
            title="Atualizar dados"
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          <Button
            onClick={handleOpenCreateItem}
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs gap-1.5"
          >
            <Plus className="w-4 h-4" /> Novo Item
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Valor Total do Estoque
            </CardTitle>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <DollarSign className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {formatCurrency(kpis.totalInventoryValue)}
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center justify-between">
              <span>Soma de (qtd × custo)</span>
              <span className="font-medium text-slate-700">{kpis.totalUnits} un. totais</span>
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total de Itens Cadastrados
            </CardTitle>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Boxes className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{kpis.totalItemsCount}</div>
            <p className="text-xs text-slate-500 mt-1">
              Distribuídos em {availableCategories.length} categorias
            </p>
          </CardContent>
        </Card>

        <Card
          className={`border-slate-200 shadow-xs transition-colors ${
            kpis.lowStockCount > 0 ? 'bg-amber-50/40 border-amber-200' : ''
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Alertas de Estoque Baixo
            </CardTitle>
            <div
              className={`p-2 rounded-lg ${
                kpis.lowStockCount > 0
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                kpis.lowStockCount > 0 ? 'text-amber-700' : 'text-slate-900'
              }`}
            >
              {kpis.lowStockCount}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {kpis.zeroStockCount > 0 ? (
                <span className="text-rose-600 font-medium">
                  {kpis.zeroStockCount} zerado{kpis.zeroStockCount > 1 ? 's' : ''}
                </span>
              ) : (
                'Itens no limite ou abaixo do mínimo'
              )}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Potencial de Venda Sugerido
            </CardTitle>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {formatCurrency(kpis.totalPotentialRevenue)}
            </div>
            <p className="text-xs text-slate-500 mt-1">Baseado nos preços sugeridos de venda</p>
          </CardContent>
        </Card>
      </div>

      {/* Alerta em Destaque quando há itens críticos */}
      {kpis.lowStockCount > 0 && (
        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-300 text-amber-900 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-amber-950">
              Atenção: Existem {kpis.lowStockCount} {kpis.lowStockCount === 1 ? 'item' : 'itens'}{' '}
              precisando de reposição!
            </p>
            <p className="text-amber-800 text-xs mt-0.5">
              Filtre pelo botão &ldquo;Estoque Baixo&rdquo; abaixo para planejar compras com
              fornecedores.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setStockStatusFilter('low')}
            className="border-amber-300 text-amber-900 hover:bg-amber-100 text-xs h-7"
          >
            Ver Críticos
          </Button>
        </div>
      )}

      {/* Filtros e Busca */}
      <Card className="border-slate-200 shadow-xs">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Busca Rápida */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <Input
                placeholder="Buscar por descrição, localização..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-white"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filtro por Categoria */}
            <div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Todas as categorias" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Categorias</SelectItem>
                  {availableCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filtro por Nível de Estoque */}
            <div>
              <Select
                value={stockStatusFilter}
                onValueChange={(val: any) => setStockStatusFilter(val)}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Status do Estoque" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="low">Abaixo do Mínimo / Alerta</SelectItem>
                  <SelectItem value="zero">Estoque Zerado</SelectItem>
                  <SelectItem value="ok">Estoque Normal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Reset Filtros */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchTerm('')
                  setSelectedCategory('all')
                  setStockStatusFilter('all')
                }}
                className="text-slate-500 hover:text-slate-800 text-xs w-full"
              >
                <Filter className="w-3.5 h-3.5 mr-1" />
                Limpar Filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Itens */}
      <Card className="border-slate-200 shadow-xs overflow-hidden">
        <CardHeader className="px-6 py-4 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold text-slate-900">
              Itens em Estoque ({filteredItems.length})
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 mt-0.5">
              Lista de itens, custos, preços sugeridos e ações rápidas de entrada e saída.
            </CardDescription>
          </div>
        </CardHeader>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              <p className="text-sm">Carregando estoque geral...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Boxes className="w-12 h-12 mx-auto mb-3 opacity-40 text-slate-500" />
              <p className="text-base font-semibold text-slate-700">Nenhum item encontrado</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {searchTerm || selectedCategory !== 'all' || stockStatusFilter !== 'all'
                  ? 'Tente ajustar os filtros de busca para encontrar o que procura.'
                  : 'Comece adicionando seu primeiro item de estoque (memórias, SSDs, monitores etc.).'}
              </p>
              {!searchTerm && selectedCategory === 'all' && (
                <Button
                  onClick={handleOpenCreateItem}
                  size="sm"
                  className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-1.5" /> Cadastrar Primeiro Item
                </Button>
              )}
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Descrição do Item</th>
                  <th className="py-3 px-4">Categoria</th>
                  <th className="py-3 px-4 text-center">Estoque Atual</th>
                  <th className="py-3 px-4 text-right">Preço Custo</th>
                  <th className="py-3 px-4 text-right">Preço Venda</th>
                  <th className="py-3 px-4">Localização</th>
                  <th className="py-3 px-4 text-right">Ações Rápidas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item) => {
                  const qty = Number(item.quantity) || 0
                  const min = Number(item.min_stock) || 0
                  const isLow = qty <= min
                  const isZero = qty === 0

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                      {/* Descrição */}
                      <td className="py-3.5 px-4 font-medium text-slate-900">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900 flex items-center gap-2">
                            {item.description}
                            {isZero ? (
                              <Badge variant="destructive" className="text-[10px] py-0 px-1.5 h-4">
                                Zerado
                              </Badge>
                            ) : isLow ? (
                              <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-300 text-[10px] py-0 px-1.5 h-4">
                                Baixo (Mín: {min})
                              </Badge>
                            ) : null}
                          </span>
                          {item.notes && (
                            <span className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                              {item.notes}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Categoria */}
                      <td className="py-3.5 px-4">
                        <Badge
                          variant="secondary"
                          className="bg-slate-100 text-slate-700 font-normal border-slate-200"
                        >
                          {item.category}
                        </Badge>
                      </td>

                      {/* Quantidade Atual */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span
                            className={`text-base font-bold ${
                              isZero ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-slate-900'
                            }`}
                          >
                            {qty} <span className="text-xs font-normal text-slate-400">un.</span>
                          </span>
                          <span className="text-[11px] text-slate-400">mín: {min} un.</span>
                        </div>
                      </td>

                      {/* Preço de Custo */}
                      <td className="py-3.5 px-4 text-right text-slate-700 font-medium">
                        {formatCurrency(item.cost_price)}
                      </td>

                      {/* Preço de Venda Sugerido */}
                      <td className="py-3.5 px-4 text-right text-slate-900 font-semibold">
                        {formatCurrency(item.suggested_price)}
                      </td>

                      {/* Localização */}
                      <td className="py-3.5 px-4 text-slate-600">
                        {item.location ? (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            {item.location}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Não inf.</span>
                        )}
                      </td>

                      {/* Botões de Ação Rápida */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Entrada Rápida */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenMovementModal(item, 'entrada')}
                            className="h-8 px-2.5 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
                            title="Dar entrada no estoque"
                          >
                            <ArrowDownLeft className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                            Entrada
                          </Button>

                          {/* Saída Rápida */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenMovementModal(item, 'saida')}
                            disabled={qty === 0}
                            className="h-8 px-2.5 text-xs text-rose-700 border-rose-200 hover:bg-rose-50 hover:text-rose-800 disabled:opacity-40"
                            title={qty === 0 ? 'Sem estoque para saída' : 'Dar saída do estoque'}
                          >
                            <ArrowUpRight className="w-3.5 h-3.5 mr-1 text-rose-600" />
                            Saída
                          </Button>

                          {/* Ajuste de Contagem */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenMovementModal(item, 'ajuste')}
                            className="h-8 w-8 p-0 text-slate-500 hover:text-slate-800"
                            title="Ajuste / Contagem física"
                          >
                            <SlidersHorizontal className="w-4 h-4" />
                          </Button>

                          {/* Histórico / Auditoria */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenHistory(item)}
                            className="h-8 w-8 p-0 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50"
                            title="Ver histórico de movimentações"
                          >
                            <History className="w-4 h-4" />
                          </Button>

                          {/* Editar Item */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenEditItem(item)}
                            className="h-8 w-8 p-0 text-slate-500 hover:text-slate-800"
                            title="Editar cadastro"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>

                          {/* Excluir (Admin) */}
                          {isAdmin && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteItem(item)}
                              className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                              title="Excluir item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* MODAL: Cadastrar / Editar Item */}
      <Dialog open={itemModalOpen} onOpenChange={setItemModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar Item' : 'Novo Item no Estoque Geral'}</DialogTitle>
            <DialogDescription>
              {editingItem
                ? 'Atualize os dados cadastrais do item.'
                : 'Cadastre componentes ou acessórios para controle avulso.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveItem} className="space-y-4 py-2">
            <div>
              <Label htmlFor="item-desc">
                Descrição do Item <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="item-desc"
                placeholder="Ex: Memória 8GB DDR4 2666MHz SODIMM"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="item-cat">Categoria</Label>
                <Select
                  value={formData.category}
                  onValueChange={(val) => setFormData({ ...formData, category: val })}
                >
                  <SelectTrigger id="item-cat" className="mt-1">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {GENERAL_INVENTORY_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                    <SelectItem value="Outra (Personalizada)">Outra (Digitar livre)...</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.category === 'Outra (Personalizada)' && (
                <div>
                  <Label htmlFor="item-cat-custom">Nome da Categoria</Label>
                  <Input
                    id="item-cat-custom"
                    placeholder="Ex: Placa de Vídeo"
                    value={formData.customCategory}
                    onChange={(e) => setFormData({ ...formData, customCategory: e.target.value })}
                    className="mt-1"
                  />
                </div>
              )}

              <div>
                <Label htmlFor="item-loc">Localização Física (Opcional)</Label>
                <Input
                  id="item-loc"
                  placeholder="Ex: Prateleira B, Caixa 12"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {!editingItem && (
                <div>
                  <Label htmlFor="item-qty">Qtd Inicial</Label>
                  <Input
                    id="item-qty"
                    type="number"
                    min="0"
                    value={formData.quantity}
                    onChange={(e) =>
                      setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })
                    }
                    className="mt-1"
                  />
                </div>
              )}

              <div>
                <Label htmlFor="item-min">Estoque Mín.</Label>
                <Input
                  id="item-min"
                  type="number"
                  min="0"
                  value={formData.min_stock}
                  onChange={(e) =>
                    setFormData({ ...formData, min_stock: parseInt(e.target.value) || 0 })
                  }
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="item-cost">Custo (R$)</Label>
                <Input
                  id="item-cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.cost_price}
                  onChange={(e) =>
                    setFormData({ ...formData, cost_price: parseFloat(e.target.value) || 0 })
                  }
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="item-price">Preço Venda</Label>
                <Input
                  id="item-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.suggested_price}
                  onChange={(e) =>
                    setFormData({ ...formData, suggested_price: parseFloat(e.target.value) || 0 })
                  }
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="item-notes">Observações / Especificações Adicionais</Label>
              <Textarea
                id="item-notes"
                placeholder="Ex: Compatível com Dell Latitude, garantia 90 dias, fornecedor X"
                rows={2}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="mt-1 resize-none"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setItemModalOpen(false)}
                disabled={isSubmittingItem}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmittingItem}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {isSubmittingItem && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingItem ? 'Salvar Alterações' : 'Cadastrar Item'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: Movimentação Rápida (Entrada / Saída / Ajuste) */}
      <Dialog open={movementModalOpen} onOpenChange={setMovementModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {movementType === 'entrada' && (
                <>
                  <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-md">
                    <ArrowDownLeft className="w-4 h-4" />
                  </div>
                  <span>Entrada de Estoque</span>
                </>
              )}
              {movementType === 'saida' && (
                <>
                  <div className="p-1.5 bg-rose-100 text-rose-700 rounded-md">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                  <span>Saída de Estoque</span>
                </>
              )}
              {movementType === 'ajuste' && (
                <>
                  <div className="p-1.5 bg-blue-100 text-blue-700 rounded-md">
                    <SlidersHorizontal className="w-4 h-4" />
                  </div>
                  <span>Ajuste / Contagem Física</span>
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              Item:{' '}
              <span className="font-semibold text-slate-800">
                {movementTargetItem?.description}
              </span>{' '}
              — Estoque atual:{' '}
              <span className="font-bold text-slate-900">
                {movementTargetItem?.quantity || 0} un.
              </span>
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveMovement} className="space-y-4 py-2">
            {movementType === 'ajuste' ? (
              <div className="space-y-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Saldo no Sistema:</span>
                    <span className="font-semibold text-slate-700">
                      {movementTargetItem?.quantity || 0} un.
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Contagem Física Digitada:</span>
                    <span className="font-semibold text-indigo-600">{physicalCountVal} un.</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-200">
                    <span className="text-slate-500">Diferença / Ajuste:</span>
                    <span
                      className={`font-bold ${
                        physicalCountVal - (movementTargetItem?.quantity || 0) > 0
                          ? 'text-emerald-600'
                          : physicalCountVal - (movementTargetItem?.quantity || 0) < 0
                            ? 'text-rose-600'
                            : 'text-slate-600'
                      }`}
                    >
                      {physicalCountVal - (movementTargetItem?.quantity || 0) > 0 ? '+' : ''}
                      {physicalCountVal - (movementTargetItem?.quantity || 0)} un.
                    </span>
                  </div>
                </div>

                <div>
                  <Label htmlFor="mov-count">Quantidade Contada Fisicamente</Label>
                  <Input
                    id="mov-count"
                    type="number"
                    min="0"
                    value={physicalCountVal}
                    onChange={(e) => setPhysicalCountVal(parseInt(e.target.value) || 0)}
                    required
                    className="mt-1 text-lg font-semibold"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="mov-qty">
                    Quantidade {movementType === 'entrada' ? 'a Entrar' : 'a Sair'}
                  </Label>
                  <Input
                    id="mov-qty"
                    type="number"
                    min="1"
                    max={movementType === 'saida' ? movementTargetItem?.quantity || 0 : undefined}
                    value={movementQty}
                    onChange={(e) => setMovementQty(Math.max(1, parseInt(e.target.value) || 1))}
                    required
                    className="mt-1 text-base font-semibold"
                  />
                  {movementType === 'saida' && (
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Máx disponível: {movementTargetItem?.quantity || 0} un.
                    </span>
                  )}
                </div>

                {movementType === 'entrada' ? (
                  <div>
                    <Label htmlFor="mov-cost">Custo Unitário (R$)</Label>
                    <Input
                      id="mov-cost"
                      type="number"
                      step="0.01"
                      min="0"
                      value={movementUnitCost}
                      onChange={(e) => setMovementUnitCost(parseFloat(e.target.value) || 0)}
                      className="mt-1"
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Atualiza o custo do item
                    </span>
                  </div>
                ) : (
                  <div>
                    <Label>Novo Saldo Previsto</Label>
                    <div className="mt-1 h-9 px-3 flex items-center bg-slate-100 rounded-md border border-slate-200 text-sm font-bold text-slate-800">
                      {(movementTargetItem?.quantity || 0) - movementQty} un.
                    </div>
                  </div>
                )}
              </div>
            )}

            <div>
              <Label htmlFor="mov-reason">Motivo / Operação</Label>
              <Input
                id="mov-reason"
                placeholder={
                  movementType === 'entrada'
                    ? 'Ex: Compra NF 1234, Devolução de bancada'
                    : movementType === 'saida'
                      ? 'Ex: Venda Avulsa, Upgrade no Notebook LOTE-01'
                      : 'Ex: Auditoria mensal'
                }
                value={movementReason}
                onChange={(e) => setMovementReason(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="mov-obs">Observações / Auditoria</Label>
              <Textarea
                id="mov-obs"
                placeholder="Detalhes adicionais (opcional)..."
                rows={2}
                value={movementObs}
                onChange={(e) => setMovementObs(e.target.value)}
                className="mt-1 resize-none"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setMovementModalOpen(false)}
                disabled={isSubmittingMovement}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmittingMovement}
                className={
                  movementType === 'entrada'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : movementType === 'saida'
                      ? 'bg-rose-600 hover:bg-rose-700 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }
              >
                {isSubmittingMovement && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Confirmar{' '}
                {movementType === 'entrada'
                  ? 'Entrada'
                  : movementType === 'saida'
                    ? 'Saída'
                    : 'Ajuste'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DRAWER: Histórico Auditável do Item */}
      <Sheet open={historyDrawerOpen} onOpenChange={setHistoryDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col bg-white">
          <SheetHeader className="p-6 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-600" />
              <SheetTitle className="text-lg font-bold text-slate-900">
                Histórico de Movimentações
              </SheetTitle>
            </div>
            <SheetDescription className="text-xs text-slate-500">
              Rastreamento completo e auditável de entradas, saídas e contagens físicas.
            </SheetDescription>
            {historyItem && (
              <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="font-semibold text-slate-900 text-sm">{historyItem.description}</p>
                <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
                  <span>Categoria: {historyItem.category}</span>
                  <span className="font-bold text-slate-800">
                    Estoque Atual: {historyItem.quantity} un.
                  </span>
                </div>
              </div>
            )}
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {loadingHistory ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                <p className="text-xs">Buscando histórico...</p>
              </div>
            ) : historyMovements.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <FileText className="w-10 h-10 mx-auto mb-2 opacity-40 text-slate-500" />
                <p className="text-sm font-semibold text-slate-700">
                  Nenhuma movimentação registrada
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Lançamentos de entrada, saída ou contagem aparecerão aqui.
                </p>
              </div>
            ) : (
              <div className="relative border-l-2 border-slate-200 ml-3 space-y-6">
                {historyMovements.map((mov) => {
                  const isEntrada = mov.type === 'entrada'
                  const isSaida = mov.type === 'saida'
                  const isAjuste = mov.type === 'ajuste'

                  return (
                    <div key={mov.id} className="relative pl-6">
                      {/* Marker Icon */}
                      <div
                        className={`absolute -left-[17px] top-0 w-8 h-8 rounded-full border-2 border-white flex items-center justify-center shadow-xs ${
                          isEntrada
                            ? 'bg-emerald-500 text-white'
                            : isSaida
                              ? 'bg-rose-500 text-white'
                              : 'bg-blue-500 text-white'
                        }`}
                      >
                        {isEntrada && <ArrowDownLeft className="w-4 h-4" />}
                        {isSaida && <ArrowUpRight className="w-4 h-4" />}
                        {isAjuste && <SlidersHorizontal className="w-4 h-4" />}
                      </div>

                      {/* Content Card */}
                      <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-xs font-bold uppercase tracking-wider ${
                              isEntrada
                                ? 'text-emerald-700'
                                : isSaida
                                  ? 'text-rose-700'
                                  : 'text-blue-700'
                            }`}
                          >
                            {isEntrada ? 'Entrada' : isSaida ? 'Saída' : 'Ajuste Físico'}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {formatDate(mov.created)}
                          </span>
                        </div>

                        <div className="flex items-baseline justify-between">
                          <span className="text-base font-bold text-slate-900">
                            {isEntrada ? '+' : isSaida ? '-' : 'Δ '}
                            {mov.quantity} un.
                          </span>
                          <span className="text-xs text-slate-500">
                            Saldo: {mov.quantity_before ?? '-'} →{' '}
                            <strong className="text-slate-800">
                              {mov.quantity_after ?? '-'} un.
                            </strong>
                          </span>
                        </div>

                        {mov.reason && (
                          <p className="text-xs text-slate-700 font-medium">
                            Motivo: <span className="font-normal text-slate-600">{mov.reason}</span>
                          </p>
                        )}

                        {mov.observation && (
                          <p className="text-xs text-slate-500 italic bg-white/80 p-1.5 rounded border border-slate-100">
                            &ldquo;{mov.observation}&rdquo;
                          </p>
                        )}

                        {mov.unit_cost !== undefined && mov.unit_cost > 0 && isEntrada && (
                          <div className="text-[11px] text-slate-500">
                            Custo informado: {formatCurrency(mov.unit_cost)}
                          </div>
                        )}

                        {mov.expand?.user_id && (
                          <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-200 flex items-center justify-between">
                            <span>Registrado por:</span>
                            <span className="font-medium text-slate-600">
                              {mov.expand.user_id.name || mov.expand.user_id.email}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
