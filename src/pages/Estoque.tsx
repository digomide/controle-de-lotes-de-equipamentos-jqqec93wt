import React, { useState, useEffect, useMemo } from 'react'
import { useLocation, Link } from 'react-router-dom'
import {
  Layers,
  Plus,
  Search,
  AlertTriangle,
  Clock,
  Calendar,
  MapPin,
  Edit2,
  Trash2,
  ArrowRight,
  TrendingUp,
  Package,
  CheckCircle2,
  SlidersHorizontal,
  Loader2,
} from 'lucide-react'
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
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import { batchesService } from '@/services/batches'
import { productsService } from '@/services/products'
import { adjustmentsService } from '@/services/adjustments'
import type { Batch, Product } from '@/types/inventory'

export default function Estoque() {
  const [batches, setBatches] = useState<Batch[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [searchFilter, setSearchFilter] = useState('')
  const [productFilter, setProductFilter] = useState<string>('all')
  const [stockLevelFilter, setStockLevelFilter] = useState<string>('all')

  // Modal State for New/Edit Batch
  const [batchModalOpen, setBatchModalOpen] = useState(false)
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null)
  const [selectedProductId, setSelectedProductId] = useState('')
  const [batchNumber, setBatchNumber] = useState('')
  const [quantity, setQuantity] = useState<number>(10)
  const [location, setLocation] = useState('')
  const [mfgDate, setMfgDate] = useState('')
  const [expDate, setExpDate] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Quick Counting Modal (Inventário Direto)
  const [countModalOpen, setCountModalOpen] = useState(false)
  const [targetBatch, setTargetBatch] = useState<Batch | null>(null)
  const [physicalCount, setPhysicalCount] = useState<number>(0)
  const [countReason, setCountReason] = useState('Contagem periódica de rotina')
  const [isSubmittingCount, setIsSubmittingCount] = useState(false)

  const { toast } = useToast()
  const { isAdmin } = useAuth()
  const locationHook = useLocation()

  const loadData = async () => {
    try {
      const [bData, pData] = await Promise.all([batchesService.getAll(), productsService.getAll()])
      setBatches(bData)
      setProducts(pData)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Parse URL search parameters (e.g. from header search or products drilldown)
  useEffect(() => {
    const params = new URLSearchParams(locationHook.search)
    const prodParam = params.get('produto')
    const buscaParam = params.get('busca')

    if (prodParam) {
      setProductFilter(prodParam)
    }
    if (buscaParam) {
      setSearchFilter(buscaParam)
    }
  }, [locationHook.search])

  // Realtime updates
  useRealtime<Batch>('batches', () => {
    batchesService.getAll().then(setBatches)
  })

  const filteredBatches = useMemo(() => {
    return batches.filter((b) => {
      const prodName = b.expand?.product_id?.name || ''
      const prodSku = b.expand?.product_id?.sku || ''

      const matchesSearch =
        b.batch_number.toLowerCase().includes(searchFilter.toLowerCase()) ||
        prodName.toLowerCase().includes(searchFilter.toLowerCase()) ||
        prodSku.toLowerCase().includes(searchFilter.toLowerCase()) ||
        (b.location && b.location.toLowerCase().includes(searchFilter.toLowerCase()))

      const matchesProduct = productFilter === 'all' || b.product_id === productFilter

      let matchesStock = true
      if (stockLevelFilter === 'low') {
        matchesStock = b.quantity <= 5
      } else if (stockLevelFilter === 'zero') {
        matchesStock = b.quantity === 0
      } else if (stockLevelFilter === 'positive') {
        matchesStock = b.quantity > 0
      }

      return matchesSearch && matchesProduct && matchesStock
    })
  }, [batches, searchFilter, productFilter, stockLevelFilter])

  const handleOpenCreateBatch = () => {
    setEditingBatch(null)
    setSelectedProductId(productFilter !== 'all' ? productFilter : products[0]?.id || '')
    setBatchNumber(
      `LOTE-${new Date().getFullYear()}-${String(batches.length + 1).padStart(3, '0')}`,
    )
    setQuantity(10)
    setLocation('Prateleira A-1')
    setMfgDate(new Date().toISOString().split('T')[0])
    const exp = new Date()
    exp.setFullYear(exp.getFullYear() + 4)
    setExpDate(exp.toISOString().split('T')[0])
    setBatchModalOpen(true)
  }

  const handleOpenEditBatch = (b: Batch) => {
    setEditingBatch(b)
    setSelectedProductId(b.product_id)
    setBatchNumber(b.batch_number)
    setQuantity(b.quantity)
    setLocation(b.location || '')
    setMfgDate(b.manufacturing_date ? b.manufacturing_date.split('T')[0] : '')
    setExpDate(b.expiry_date ? b.expiry_date.split('T')[0] : '')
    setBatchModalOpen(true)
  }

  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProductId || !batchNumber) {
      toast({
        title: 'Atenção',
        description: 'Selecione o equipamento e informe o identificador do lote.',
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)
    try {
      const data = {
        product_id: selectedProductId,
        batch_number: batchNumber.toUpperCase().trim(),
        quantity: Math.max(0, quantity),
        location,
        manufacturing_date: mfgDate ? new Date(mfgDate).toISOString() : undefined,
        expiry_date: expDate ? new Date(expDate).toISOString() : undefined,
      }

      if (editingBatch) {
        await batchesService.update(editingBatch.id, data)
        toast({
          title: 'Lote atualizado',
          description: `Lote ${batchNumber} atualizado com sucesso.`,
        })
      } else {
        await batchesService.create(data)
        toast({
          title: 'Lote cadastrado',
          description: `Novo lote ${batchNumber} registrado com saldo inicial de ${quantity} un.`,
        })
      }
      setBatchModalOpen(false)
      await loadData()
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao salvar lote',
        description: err?.message || 'Falha ao salvar no banco de dados.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteBatch = async (id: string, num: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir o lote "${num}"?`)) {
      return
    }

    try {
      await batchesService.delete(id)
      toast({
        title: 'Lote excluído',
        description: `O lote ${num} foi removido do inventário.`,
      })
      await loadData()
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível remover o lote. Ele pode ter vendas vinculadas.',
        variant: 'destructive',
      })
    }
  }

  // Quick Counting Flow
  const handleOpenQuickCount = (b: Batch) => {
    setTargetBatch(b)
    setPhysicalCount(b.quantity)
    setCountReason('Conferência física na prateleira')
    setCountModalOpen(true)
  }

  const handleConfirmQuickCount = async () => {
    if (!targetBatch) return
    const divergence = physicalCount - targetBatch.quantity

    setIsSubmittingCount(true)
    try {
      await adjustmentsService.create({
        batch_id: targetBatch.id,
        type: 'count_adjustment',
        quantity_before: targetBatch.quantity,
        physical_count: physicalCount,
        quantity_change: divergence,
        reason: countReason,
      })

      toast({
        title: 'Contagem confirmada!',
        description: `Lote ${targetBatch.batch_number} ajustado para ${physicalCount} un (Divergência: ${
          divergence >= 0 ? `+${divergence}` : divergence
        }).`,
      })
      setCountModalOpen(false)
      await loadData()
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao ajustar',
        description: 'Falha ao processar o ajuste de inventário.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmittingCount(false)
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Controle de Lotes & Estoque
          </h2>
          <p className="text-sm text-slate-500">
            Rastreabilidade detalhada por lote com identificador, datas de fabricação/validade e
            localização.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/ajustes">
            <Button variant="outline" className="gap-2 border-slate-300">
              <SlidersHorizontal className="w-4 h-4" />
              Contagem Geral
            </Button>
          </Link>
          {isAdmin && (
            <Button
              onClick={handleOpenCreateBatch}
              className="bg-slate-900 hover:bg-slate-800 text-white shadow gap-2"
            >
              <Plus className="w-4 h-4" />
              Novo Lote
            </Button>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative sm:col-span-2">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <Input
                placeholder="Buscar por lote, produto, SKU ou prateleira..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="pl-9 bg-slate-50 border-slate-200"
              />
            </div>

            {/* Product Filter */}
            <div>
              <Select value={productFilter} onValueChange={setProductFilter}>
                <SelectTrigger className="bg-slate-50 border-slate-200">
                  <SelectValue placeholder="Filtrar por Equipamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Equipamentos</SelectItem>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Stock Level Filter */}
            <div>
              <Select value={stockLevelFilter} onValueChange={setStockLevelFilter}>
                <SelectTrigger className="bg-slate-50 border-slate-200">
                  <SelectValue placeholder="Nível de Estoque" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Níveis</SelectItem>
                  <SelectItem value="low">Baixo Estoque (≤ 5 un)</SelectItem>
                  <SelectItem value="positive">Estoque Positivo (&gt; 0)</SelectItem>
                  <SelectItem value="zero">Estoque Zerado (0 un)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* High-density Batches Table */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">Identificador do Lote</th>
                <th className="py-3 px-4">Equipamento Vinculado</th>
                <th className="py-3 px-4">Localização</th>
                <th className="py-3 px-4">Fabricação</th>
                <th className="py-3 px-4">Validade / Garantia</th>
                <th className="py-3 px-4 text-center">Quantidade Atual</th>
                <th className="py-3 px-4 text-right">Ações Operacionais</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Nenhum lote físico encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredBatches.map((b) => {
                  const isLow = b.quantity <= 5 && b.quantity > 0
                  const isZero = b.quantity === 0

                  return (
                    <tr
                      key={b.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isLow ? 'bg-rose-50/30' : ''
                      }`}
                    >
                      {/* Batch Identifier */}
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap text-xs">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                          <Layers className="w-3 h-3 text-slate-500" />
                          {b.batch_number}
                        </span>
                      </td>

                      {/* Product Name */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-900 text-xs">
                          {b.expand?.product_id?.name || 'Equipamento'}
                        </div>
                        <span className="text-[11px] font-mono text-slate-400">
                          SKU: {b.expand?.product_id?.sku || '—'}
                        </span>
                      </td>

                      {/* Location */}
                      <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-600">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {b.location || 'Depósito Central'}
                        </div>
                      </td>

                      {/* Manufacturing Date */}
                      <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-500 font-mono">
                        {b.manufacturing_date
                          ? new Date(b.manufacturing_date).toLocaleDateString('pt-BR')
                          : '—'}
                      </td>

                      {/* Expiry / Warranty Date */}
                      <td className="py-3 px-4 whitespace-nowrap text-xs font-mono">
                        {b.expiry_date ? (
                          <span className="text-slate-700">
                            {new Date(b.expiry_date).toLocaleDateString('pt-BR')}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Quantity with badge */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold font-mono ${
                            isZero
                              ? 'bg-slate-200 text-slate-600'
                              : isLow
                                ? 'bg-rose-100 text-rose-800 animate-pulse'
                                : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {b.quantity} un
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap space-x-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenQuickCount(b)}
                          className="h-8 text-xs gap-1 border-slate-200 text-slate-700 hover:bg-slate-100"
                          title="Realizar contagem de inventário deste lote"
                        >
                          <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                          Contagem
                        </Button>

                        {isAdmin && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEditBatch(b)}
                              className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900"
                              title="Editar lote"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteBatch(b.id, b.batch_number)}
                              className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600"
                              title="Excluir lote"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* CREATE / EDIT BATCH DIALOG */}
      <Dialog open={batchModalOpen} onOpenChange={setBatchModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-slate-700" />
              {editingBatch ? 'Editar Lote Físico' : 'Cadastrar Novo Lote'}
            </DialogTitle>
            <DialogDescription>
              Vincule um novo lote a um equipamento com quantidade inicial e localização.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveBatch} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="batchProd" className="text-xs font-semibold text-slate-700">
                Equipamento *
              </Label>
              <Select
                value={selectedProductId}
                onValueChange={setSelectedProductId}
                disabled={!!editingBatch}
              >
                <SelectTrigger id="batchProd" className="bg-white">
                  <SelectValue placeholder="Selecione o equipamento" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="bNum" className="text-xs font-semibold text-slate-700">
                  Identificador do Lote *
                </Label>
                <Input
                  id="bNum"
                  placeholder="Ex: LOTE-2024-001"
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  className="font-mono text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="bQty" className="text-xs font-semibold text-slate-700">
                  Quantidade Física *
                </Label>
                <Input
                  id="bQty"
                  type="number"
                  min="0"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="bLoc" className="text-xs font-semibold text-slate-700">
                Localização no Estoque
              </Label>
              <Input
                id="bLoc"
                placeholder="Ex: Prateleira B-3, Gaveta 2"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="bMfg" className="text-xs font-semibold text-slate-700">
                  Data de Fabricação
                </Label>
                <Input
                  id="bMfg"
                  type="date"
                  value={mfgDate}
                  onChange={(e) => setMfgDate(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="bExp" className="text-xs font-semibold text-slate-700">
                  Validade / Garantia
                </Label>
                <Input
                  id="bExp"
                  type="date"
                  value={expDate}
                  onChange={(e) => setExpDate(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setBatchModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-slate-900 hover:bg-slate-800 text-white"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Lote'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* QUICK INVENTORY COUNT MODAL */}
      <Dialog open={countModalOpen} onOpenChange={setCountModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Contagem Física de Inventário
            </DialogTitle>
            <DialogDescription>
              Informe a quantidade apurada fisicamente no armazém. O sistema calculará a divergência
              e ajustará o saldo.
            </DialogDescription>
          </DialogHeader>

          {targetBatch && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Equipamento:</span>
                  <strong className="text-slate-800">{targetBatch.expand?.product_id?.name}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Lote:</span>
                  <strong className="font-mono text-slate-800">{targetBatch.batch_number}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Local Atual:</span>
                  <strong className="text-slate-700">
                    {targetBatch.location || 'Depósito Geral'}
                  </strong>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200">
                  <span className="text-slate-600 font-semibold">Saldo no Sistema:</span>
                  <strong className="text-slate-900 text-sm font-mono">
                    {targetBatch.quantity} un
                  </strong>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="physCount" className="text-xs font-bold text-slate-700">
                  Contagem Física Real (Unidades) *
                </Label>
                <Input
                  id="physCount"
                  type="number"
                  min="0"
                  value={physicalCount}
                  onChange={(e) => setPhysicalCount(parseInt(e.target.value) || 0)}
                  className="text-lg font-bold font-mono h-11"
                  autoFocus
                />
              </div>

              {/* Discrepancy Calculation Box */}
              {(() => {
                const diff = physicalCount - targetBatch.quantity
                return (
                  <div
                    className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                      diff === 0
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : diff < 0
                          ? 'bg-rose-50 border-rose-200 text-rose-800'
                          : 'bg-blue-50 border-blue-200 text-blue-800'
                    }`}
                  >
                    <div>
                      <span className="font-bold block">
                        {diff === 0
                          ? 'Estoque conferido! Sem divergência.'
                          : diff < 0
                            ? 'Falta no estoque físico (Divergência Negativa)'
                            : 'Sobra no estoque físico (Divergência Positiva)'}
                      </span>
                      <span className="text-[11px] opacity-80">
                        {diff === 0
                          ? 'A contagem bate com o saldo registrado.'
                          : `O sistema criará um lançamento de ajuste de ${diff >= 0 ? `+${diff}` : diff} un.`}
                      </span>
                    </div>
                    <div className="text-xl font-bold font-mono">
                      {diff > 0 ? `+${diff}` : diff}
                    </div>
                  </div>
                )
              })()}

              <div className="space-y-1">
                <Label htmlFor="countReas" className="text-xs font-semibold text-slate-700">
                  Justificativa / Motivo do Ajuste
                </Label>
                <Input
                  id="countReas"
                  placeholder="Ex: Auditoria cíclica semanal, avaria ou quebra..."
                  value={countReason}
                  onChange={(e) => setCountReason(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCountModalOpen(false)}
              disabled={isSubmittingCount}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmQuickCount}
              disabled={isSubmittingCount}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow"
            >
              {isSubmittingCount ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Confirmar Contagem & Ajustar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
