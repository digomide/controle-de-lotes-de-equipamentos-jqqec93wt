import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { magaluService, MagaluItem, MagaluStatusResponse } from '@/services/magaluService'
import {
  ShoppingBag,
  RefreshCw,
  Search,
  ExternalLink,
  CheckCircle2,
  PauseCircle,
  XCircle,
  AlertTriangle,
  Layers,
  Save,
  Check,
  Package,
  Boxes,
  Percent,
} from 'lucide-react'

export function MagaluItemsTab() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [progressText, setProgressText] = useState('')
  const [status, setStatus] = useState<MagaluStatusResponse | null>(null)
  const [items, setItems] = useState<MagaluItem[]>([])

  // Filtros
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Edição inline
  const [editingSku, setEditingSku] = useState<string | null>(null)
  const [editPrice, setEditPrice] = useState<string>('')
  const [editStock, setEditStock] = useState<string>('')
  const [savingSku, setSavingSku] = useState<string | null>(null)

  // Seleção e alteração em massa
  const [selectedSkus, setSelectedSkus] = useState<Set<string>>(new Set())
  const [bulkPriceInput, setBulkPriceInput] = useState('')
  const [bulkStockInput, setBulkStockInput] = useState('')
  const [bulkAction, setBulkAction] = useState<'fixed' | 'percent_increase' | 'percent_decrease'>(
    'fixed',
  )
  const [applyingBulk, setApplyingBulk] = useState(false)

  const loadData = async (forceRefresh = false) => {
    setLoading(true)
    try {
      const st = await magaluService.getStatus()
      setStatus(st)

      if (!st.connected) {
        setItems([])
        setLoading(false)
        return
      }

      const res = await magaluService.fetchItems({
        forceRefresh,
        onProgress: (msg) => setProgressText(msg),
      })

      if (res.error) {
        toast({
          title: 'Aviso sobre o Magalu',
          description: res.error,
          variant: 'destructive',
        })
      }
      setItems(res.items || [])
    } catch (err: unknown) {
      toast({
        title: 'Erro ao carregar anúncios Magalu',
        description: String(err),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
      setSyncing(false)
      setProgressText('')
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleManualSync = async () => {
    setSyncing(true)
    await loadData(true)
  }

  // Filtragem
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false
      }
      if (search.trim()) {
        const q = search.toLowerCase().trim()
        const matchSku = item.sku.toLowerCase().includes(q)
        const matchTitle = (item.title || '').toLowerCase().includes(q)
        const matchBrand = (item.brand || '').toLowerCase().includes(q)
        if (!matchSku && !matchTitle && !matchBrand) return false
      }
      return true
    })
  }, [items, statusFilter, search])

  // Contadores
  const stats = useMemo(() => {
    const total = items.length
    const active = items.filter((i) => i.status === 'active' || i.available_quantity > 0).length
    const paused = items.filter((i) => i.status === 'paused' || i.available_quantity === 0).length
    const closed = items.filter((i) => i.status === 'closed').length
    const totalStock = items.reduce((acc, i) => acc + (i.available_quantity || 0), 0)
    return { total, active, paused, closed, totalStock }
  }, [items])

  // Iniciar edição inline
  const startEdit = (item: MagaluItem) => {
    setEditingSku(item.sku)
    setEditPrice(item.price ? item.price.toFixed(2) : '')
    setEditStock(String(item.available_quantity ?? 0))
  }

  const cancelEdit = () => {
    setEditingSku(null)
    setEditPrice('')
    setEditStock('')
  }

  // Salvar edição inline
  const handleSaveInline = async (item: MagaluItem) => {
    const numPrice = parseFloat(editPrice.replace(',', '.'))
    const numStock = parseInt(editStock, 10)

    if (isNaN(numPrice) || numPrice <= 0) {
      toast({
        title: 'Preço inválido',
        description: 'Informe um preço válido maior que zero.',
        variant: 'destructive',
      })
      return
    }

    if (isNaN(numStock) || numStock < 0) {
      toast({
        title: 'Estoque inválido',
        description: 'Informe uma quantidade de estoque maior ou igual a zero.',
        variant: 'destructive',
      })
      return
    }

    setSavingSku(item.sku)
    try {
      const res = await magaluService.updateItem({
        sku: item.sku,
        new_price: numPrice,
        new_quantity: numStock,
        action: 'update_price_stock',
      })

      if (res.success) {
        toast({
          title: 'Anúncio Atualizado no Magalu!',
          description: `Preço atualizado para R$ ${numPrice.toFixed(2)} e estoque para ${numStock} un.`,
        })
        // Atualiza no estado local
        setItems((prev) =>
          prev.map((i) =>
            i.sku === item.sku
              ? {
                  ...i,
                  price: numPrice,
                  available_quantity: numStock,
                  status: numStock > 0 ? 'active' : 'paused',
                }
              : i,
          ),
        )
        setEditingSku(null)
      } else {
        toast({
          title: 'Erro ao atualizar no Magalu',
          description: res.error || 'A API Magalu rejeitou a alteração.',
          variant: 'destructive',
        })
      }
    } catch (err: unknown) {
      toast({
        title: 'Falha na conexão',
        description: String(err),
        variant: 'destructive',
      })
    } finally {
      setSavingSku(null)
    }
  }

  // Alternar pausa / ativação
  const handleToggleStatus = async (item: MagaluItem) => {
    const isCurrentlyActive = item.status === 'active' && item.available_quantity > 0
    const nextAction = isCurrentlyActive ? 'pause' : 'activate'

    setSavingSku(item.sku)
    try {
      const res = await magaluService.updateItem({
        sku: item.sku,
        action: nextAction,
        new_quantity: isCurrentlyActive ? 0 : 1,
      })

      if (res.success) {
        toast({
          title: isCurrentlyActive ? 'Anúncio Pausado' : 'Anúncio Ativado',
          description: `Status do SKU ${item.sku} atualizado no Magalu.`,
        })
        setItems((prev) =>
          prev.map((i) =>
            i.sku === item.sku
              ? {
                  ...i,
                  status: isCurrentlyActive ? 'paused' : 'active',
                  available_quantity: isCurrentlyActive ? 0 : Math.max(1, i.available_quantity),
                }
              : i,
          ),
        )
      } else {
        toast({
          title: 'Erro ao alterar status',
          description: res.error,
          variant: 'destructive',
        })
      }
    } finally {
      setSavingSku(null)
    }
  }

  // Seleção múltipla
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedSkus(new Set(filteredItems.map((i) => i.sku)))
    } else {
      setSelectedSkus(new Set())
    }
  }

  const toggleSelectSku = (sku: string) => {
    const next = new Set(selectedSkus)
    if (next.has(sku)) {
      next.delete(sku)
    } else {
      next.add(sku)
    }
    setSelectedSkus(next)
  }

  // Ação em massa
  const handleApplyBulk = async () => {
    if (selectedSkus.size === 0) return

    setApplyingBulk(true)
    try {
      const skusArray = Array.from(selectedSkus)
      const selectedItemsList = items.filter((i) => selectedSkus.has(i.sku))

      // 1. Preços em massa se informado
      if (bulkPriceInput.trim()) {
        const val = parseFloat(bulkPriceInput.replace(',', '.'))
        if (!isNaN(val) && val > 0) {
          const updates = selectedItemsList.map((item) => {
            let nextPrice = item.price
            if (bulkAction === 'fixed') {
              nextPrice = val
            } else if (bulkAction === 'percent_increase') {
              nextPrice = item.price * (1 + val / 100)
            } else if (bulkAction === 'percent_decrease') {
              nextPrice = item.price * (1 - val / 100)
            }
            return {
              sku: item.sku,
              price: Math.max(0.01, parseFloat(nextPrice.toFixed(2))),
            }
          })

          const res = await magaluService.bulkUpdatePrices(updates)
          toast({
            title: 'Preços em massa atualizados',
            description: `${res.successCount} de ${updates.length} produtos atualizados no Magalu.`,
          })
        }
      }

      // 2. Estoque em massa se informado
      if (bulkStockInput.trim()) {
        const valStock = parseInt(bulkStockInput, 10)
        if (!isNaN(valStock) && valStock >= 0) {
          const updatesStock = skusArray.map((sku) => ({
            sku,
            quantity: valStock,
          }))

          const resStock = await magaluService.bulkUpdateStock(updatesStock)
          toast({
            title: 'Estoque em massa atualizado',
            description: `${resStock.successCount} de ${updatesStock.length} ofertas atualizadas no Magalu.`,
          })
        }
      }

      // Recarrega
      setSelectedSkus(new Set())
      setBulkPriceInput('')
      setBulkStockInput('')
      await loadData(true)
    } catch (err: unknown) {
      toast({
        title: 'Erro na operação em massa',
        description: String(err),
        variant: 'destructive',
      })
    } finally {
      setApplyingBulk(false)
    }
  }

  if (!status?.connected) {
    return (
      <Card className="border border-slate-200 shadow-xs">
        <CardContent className="p-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-slate-900 text-lg">Integração Magalu não conectada</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Para gerenciar ofertas, atualizar preços e controlar estoques do Magalu Marketplace,
              cadastre seu Client ID e Client Secret em Configurações.
            </p>
          </div>
          <Button
            onClick={() => (window.location.href = '/configuracoes')}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
          >
            Configurar Credenciais do Magalu
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Contadores estatísticos */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="border-slate-200 shadow-xs">
          <CardContent className="p-4">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block">
              Total no Magalu
            </span>
            <span className="text-2xl font-black text-slate-900 mt-1 block font-mono">
              {stats.total}
            </span>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50/30 shadow-xs">
          <CardContent className="p-4">
            <span className="text-[11px] uppercase tracking-wider text-emerald-700 font-bold block flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Ativos
            </span>
            <span className="text-2xl font-black text-emerald-700 mt-1 block font-mono">
              {stats.active}
            </span>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50/30 shadow-xs">
          <CardContent className="p-4">
            <span className="text-[11px] uppercase tracking-wider text-amber-700 font-bold block flex items-center gap-1">
              <PauseCircle className="w-3.5 h-3.5" /> Pausados / S. Estoque
            </span>
            <span className="text-2xl font-black text-amber-700 mt-1 block font-mono">
              {stats.paused}
            </span>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-xs">
          <CardContent className="p-4">
            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold block flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5" /> Encerrados
            </span>
            <span className="text-2xl font-black text-slate-700 mt-1 block font-mono">
              {stats.closed}
            </span>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50/30 shadow-xs">
          <CardContent className="p-4">
            <span className="text-[11px] uppercase tracking-wider text-blue-700 font-bold block flex items-center gap-1">
              <Boxes className="w-3.5 h-3.5 text-blue-600" /> Unidades em Estoque
            </span>
            <span className="text-2xl font-black text-blue-700 mt-1 block font-mono">
              {stats.totalStock}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros e Busca */}
      <Card className="border-slate-200 shadow-xs">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Filtrar por SKU, título, marca ou modelo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 text-xs h-9 bg-slate-50 border-slate-200 focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="text-xs h-9 w-[150px] bg-slate-50 border-slate-200">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="paused">Pausados</SelectItem>
                  <SelectItem value="closed">Encerrados</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={handleManualSync}
                disabled={syncing}
                className="text-xs h-9 font-medium border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Sincronizando...' : 'Sincronizar Magalu'}
              </Button>
            </div>
          </div>

          {/* Painel de Ações em Massa */}
          {selectedSkus.size > 0 && (
            <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
                <span className="font-bold text-blue-900">
                  {selectedSkus.size} produto(s) Magalu selecionado(s)
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-md px-2 py-0.5">
                  <span className="text-[11px] text-slate-500">Preço:</span>
                  <select
                    value={bulkAction}
                    onChange={(e) => setBulkAction(e.target.value as any)}
                    className="text-xs border-none bg-transparent outline-none font-medium"
                  >
                    <option value="fixed">R$ Fixo</option>
                    <option value="percent_increase">+% Aumento</option>
                    <option value="percent_decrease">-% Redução</option>
                  </select>
                  <Input
                    type="number"
                    placeholder="Valor"
                    value={bulkPriceInput}
                    onChange={(e) => setBulkPriceInput(e.target.value)}
                    className="w-20 h-7 text-xs border-slate-200"
                  />
                </div>

                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-md px-2 py-0.5">
                  <span className="text-[11px] text-slate-500">Estoque:</span>
                  <Input
                    type="number"
                    placeholder="Qtd"
                    value={bulkStockInput}
                    onChange={(e) => setBulkStockInput(e.target.value)}
                    className="w-16 h-7 text-xs border-slate-200"
                  />
                </div>

                <Button
                  size="sm"
                  onClick={handleApplyBulk}
                  disabled={applyingBulk || (!bulkPriceInput && !bulkStockInput)}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8"
                >
                  <Percent className="w-3.5 h-3.5 mr-1" />
                  {applyingBulk ? 'Aplicando...' : 'Aplicar em Massa'}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedSkus(new Set())}
                  className="text-xs h-8 text-slate-500"
                >
                  Desmarcar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conteúdo: Tabela de Anúncios */}
      {loading ? (
        <div className="p-16 text-center text-slate-400 space-y-3 bg-white rounded-xl border border-slate-200">
          <RefreshCw className="w-8 h-8 mx-auto animate-spin text-blue-600" />
          <p className="text-sm font-semibold text-slate-700">
            {progressText || 'Carregando catálogo de produtos do Magalu...'}
          </p>
        </div>
      ) : filteredItems.length === 0 ? (
        <Card className="border-dashed border-slate-300 shadow-none bg-slate-50/50">
          <CardContent className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center mx-auto">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 text-base">
              Nenhum anúncio retornado do Magalu
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Se você acabou de vincular sua conta de Seller, verifique se seus produtos estão
              cadastrados no portal Magalu Marketplace ou clique em &quot;Sincronizar Magalu&quot;.
            </p>
            <Button variant="outline" size="sm" onClick={handleManualSync} className="text-xs h-8">
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Tentar Novamente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-200 select-none">
                <tr>
                  <th className="py-3 px-3 w-8">
                    <input
                      type="checkbox"
                      checked={
                        selectedSkus.size === filteredItems.length && filteredItems.length > 0
                      }
                      onChange={handleSelectAll}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="py-3 px-3">SKU & Produto Magalu</th>
                  <th className="py-3 px-3 w-28">Status</th>
                  <th className="py-3 px-3 w-36">Preço de Venda</th>
                  <th className="py-3 px-3 w-28">Estoque</th>
                  <th className="py-3 px-3 w-32 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item) => {
                  const isSelected = selectedSkus.has(item.sku)
                  const isEditing = editingSku === item.sku
                  const isSaving = savingSku === item.sku

                  return (
                    <tr
                      key={item.sku}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? 'bg-blue-50/40' : ''
                      }`}
                    >
                      <td className="py-3 px-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectSku(item.sku)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>

                      {/* Produto & SKU */}
                      <td className="py-3 px-3">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                            {item.thumbnail ? (
                              <img
                                src={item.thumbnail}
                                alt={item.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Package className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[11px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                SKU: {item.sku}
                              </span>
                              {item.condition && (
                                <Badge variant="outline" className="text-[10px] text-slate-500">
                                  {item.condition === 'refurbished'
                                    ? 'Recondicionado'
                                    : item.condition}
                                </Badge>
                              )}
                            </div>
                            <p className="font-semibold text-slate-900 text-xs truncate max-w-md">
                              {item.title}
                            </p>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400">
                              {item.brand && <span>Marca: {item.brand}</span>}
                              {item.permalink && (
                                <a
                                  href={item.permalink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 flex items-center gap-0.5 font-medium"
                                >
                                  Ver no Magalu <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        {item.status === 'active' || item.available_quantity > 0 ? (
                          <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[10px]">
                            Ativo
                          </Badge>
                        ) : item.status === 'closed' ? (
                          <Badge variant="outline" className="text-slate-500 text-[10px]">
                            Encerrado
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-500 hover:bg-amber-500 text-white text-[10px]">
                            Pausado
                          </Badge>
                        )}
                      </td>

                      {/* Preço (Inline) */}
                      <td className="py-3 px-3">
                        {isEditing ? (
                          <div className="space-y-1">
                            <Input
                              type="text"
                              value={editPrice}
                              onChange={(e) => setEditPrice(e.target.value)}
                              placeholder="0,00"
                              className="h-8 text-xs font-mono font-bold w-28 bg-white border-blue-300"
                              autoFocus
                            />
                            <span className="text-[10px] text-slate-400 block">Ex: 1499.90</span>
                          </div>
                        ) : (
                          <div>
                            <span className="font-bold text-slate-900 font-mono text-sm block">
                              R${' '}
                              {item.price
                                ? item.price.toLocaleString('pt-BR', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })
                                : '0,00'}
                            </span>
                            {item.list_price && item.list_price > item.price && (
                              <span className="text-[10px] text-slate-400 line-through">
                                R${' '}
                                {item.list_price.toLocaleString('pt-BR', {
                                  minimumFractionDigits: 2,
                                })}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Estoque (Inline) */}
                      <td className="py-3 px-3">
                        {isEditing ? (
                          <Input
                            type="number"
                            value={editStock}
                            onChange={(e) => setEditStock(e.target.value)}
                            className="h-8 text-xs font-mono font-bold w-20 bg-white border-blue-300"
                          />
                        ) : (
                          <span
                            className={`font-mono font-bold text-xs px-2 py-1 rounded ${
                              item.available_quantity > 0
                                ? 'bg-slate-100 text-slate-800'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {item.available_quantity} un.
                          </span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-3 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              onClick={() => handleSaveInline(item)}
                              disabled={isSaving}
                              className="h-7 px-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                            >
                              <Save className="w-3.5 h-3.5 mr-1" />
                              {isSaving ? 'Salvando...' : 'Salvar'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={cancelEdit}
                              disabled={isSaving}
                              className="h-7 px-2 text-xs text-slate-500"
                            >
                              Cancelar
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => startEdit(item)}
                              disabled={isSaving}
                              className="h-7 px-2 text-xs text-slate-700 hover:text-blue-700 hover:border-blue-300"
                            >
                              Editar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleStatus(item)}
                              disabled={isSaving}
                              className="h-7 px-2 text-xs text-slate-500 hover:text-slate-800"
                              title={
                                item.available_quantity > 0 ? 'Pausar anúncio' : 'Ativar anúncio'
                              }
                            >
                              {item.available_quantity > 0 ? 'Pausar' : 'Ativar'}
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
