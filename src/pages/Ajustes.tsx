import React, { useState, useEffect, useMemo } from 'react'
import {
  SlidersHorizontal,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  RotateCcw,
  Clock,
  Layers,
  FileText,
  User,
  ShieldCheck,
  Loader2,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import { adjustmentsService } from '@/services/adjustments'
import { batchesService } from '@/services/batches'
import { productsService } from '@/services/products'
import type { InventoryAdjustment, Batch, Product } from '@/types/inventory'

export default function Ajustes() {
  const [adjustments, setAdjustments] = useState<InventoryAdjustment[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')

  // Adjustment Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedBatchId, setSelectedBatchId] = useState('')
  const [adjType, setAdjType] = useState<'count_adjustment' | 'manual_entry' | 'return'>(
    'count_adjustment',
  )
  const [physicalCount, setPhysicalCount] = useState<number>(0)
  const [manualChange, setManualChange] = useState<number>(0)
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { toast } = useToast()
  const { isAdmin, user } = useAuth()

  const loadData = async () => {
    try {
      const [adjData, bData, pData] = await Promise.all([
        adjustmentsService.getAll(),
        batchesService.getAll(),
        productsService.getAll(),
      ])
      setAdjustments(adjData)
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

  useRealtime<InventoryAdjustment>('inventory_adjustments', () => {
    adjustmentsService.getAll().then(setAdjustments)
  })

  useRealtime<Batch>('batches', () => {
    batchesService.getAll().then(setBatches)
  })

  // Target Batch for calculation
  const targetBatch = useMemo(() => {
    return batches.find((b) => b.id === selectedBatchId)
  }, [batches, selectedBatchId])

  // When changing batch in modal, reset physical count to its current quantity
  const handleBatchSelect = (bId: string) => {
    setSelectedBatchId(bId)
    const b = batches.find((item) => item.id === bId)
    if (b) {
      setPhysicalCount(b.quantity)
      setManualChange(0)
    }
  }

  const calculatedDiscrepancy = useMemo(() => {
    if (!targetBatch) return 0
    if (adjType === 'count_adjustment') {
      return physicalCount - targetBatch.quantity
    }
    return manualChange
  }, [targetBatch, adjType, physicalCount, manualChange])

  const projectedNewTotal = useMemo(() => {
    if (!targetBatch) return 0
    if (adjType === 'count_adjustment') {
      return Math.max(0, physicalCount)
    }
    return Math.max(0, targetBatch.quantity + manualChange)
  }, [targetBatch, adjType, physicalCount, manualChange])

  const handleOpenModal = () => {
    if (batches.length > 0) {
      setSelectedBatchId(batches[0].id)
      setPhysicalCount(batches[0].quantity)
    } else {
      setSelectedBatchId('')
    }
    setAdjType('count_adjustment')
    setManualChange(0)
    setReason('')
    setModalOpen(true)
  }

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBatchId || !targetBatch) {
      toast({
        title: 'Selecione um lote',
        description: 'É necessário selecionar o lote que sofrerá o ajuste.',
        variant: 'destructive',
      })
      return
    }

    if (!reason.trim()) {
      toast({
        title: 'Motivo obrigatório',
        description: 'Por conformidade de auditoria, informe a justificativa do ajuste.',
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)
    try {
      await adjustmentsService.create({
        batch_id: targetBatch.id,
        type: adjType,
        quantity_before: targetBatch.quantity,
        physical_count: adjType === 'count_adjustment' ? physicalCount : undefined,
        quantity_change: calculatedDiscrepancy,
        reason: reason.trim(),
      })

      toast({
        title: 'Ajuste concluído com sucesso!',
        description: `O lote ${targetBatch.batch_number} foi atualizado para ${projectedNewTotal} un no estoque.`,
      })

      setModalOpen(false)
      await loadData()
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao registrar ajuste',
        description: err?.message || 'Falha ao sincronizar quantidade.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Filtered adjustments
  const filteredAdjustments = useMemo(() => {
    return adjustments.filter((a) => {
      const batchNum = a.expand?.batch_id?.batch_number || ''
      const prodName = a.expand?.batch_id?.expand?.product_id?.name || ''
      const userName = a.expand?.user_id?.name || ''
      const reasonText = a.reason || ''

      const matchesSearch =
        batchNum.toLowerCase().includes(searchTerm.toLowerCase()) ||
        prodName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        reasonText.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesType = typeFilter === 'all' || a.type === typeFilter

      return matchesSearch && matchesType
    })
  }, [adjustments, searchTerm, typeFilter])

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Ajustes & Auditoria de Inventário
          </h2>
          <p className="text-sm text-slate-500">
            Registro de divergências apuradas na contagem física, entradas manuais e histórico
            auditável de alterações.
          </p>
        </div>
        <Button
          onClick={handleOpenModal}
          className="bg-slate-900 hover:bg-slate-800 text-white shadow gap-2"
        >
          <Plus className="w-4 h-4" />
          Novo Ajuste / Contagem
        </Button>
      </div>

      {/* Filter Toolbar */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <Input
                placeholder="Buscar por lote, equipamento, motivo ou responsável..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-slate-50 border-slate-200"
              />
            </div>
            <div className="w-full sm:w-64">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="bg-slate-50 border-slate-200">
                  <SelectValue placeholder="Tipo de Operação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Tipos</SelectItem>
                  <SelectItem value="count_adjustment">Contagem de Inventário</SelectItem>
                  <SelectItem value="manual_entry">Entrada Manual / Reposição</SelectItem>
                  <SelectItem value="return">Devolução de Equipamento</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Adjustments Audit Table */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-slate-900 flex items-center justify-between">
            <span>Histórico de Lançamentos de Auditoria</span>
            <Badge variant="outline" className="text-xs bg-slate-50 border-slate-200">
              {filteredAdjustments.length} registros
            </Badge>
          </CardTitle>
          <CardDescription>
            Cada alteração manual ou de contagem física é registrada com data, divergência e
            responsável.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-t border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">Data / Hora</th>
                <th className="py-3 px-4">Lote Físico</th>
                <th className="py-3 px-4">Equipamento</th>
                <th className="py-3 px-4 text-center">Tipo</th>
                <th className="py-3 px-4 text-right">Saldo Anterior</th>
                <th className="py-3 px-4 text-center">Divergência / Variação</th>
                <th className="py-3 px-4">Justificativa / Motivo</th>
                <th className="py-3 px-4">Responsável</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAdjustments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Nenhum lançamento de ajuste encontrado.
                  </td>
                </tr>
              ) : (
                filteredAdjustments.map((adj) => {
                  const isPositive = adj.quantity_change > 0
                  const isNegative = adj.quantity_change < 0

                  return (
                    <tr key={adj.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                        {new Date(adj.created).toLocaleDateString('pt-BR')} às{' '}
                        {new Date(adj.created).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap text-xs">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                          <Layers className="w-3 h-3 text-slate-500" />
                          {adj.expand?.batch_id?.batch_number || 'Lote'}
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-xs font-medium text-slate-900">
                        {adj.expand?.batch_id?.expand?.product_id?.name || 'Equipamento'}
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {adj.type === 'count_adjustment' && (
                          <Badge
                            variant="outline"
                            className="bg-blue-50 text-blue-700 border-blue-200 text-[11px]"
                          >
                            Contagem
                          </Badge>
                        )}
                        {adj.type === 'manual_entry' && (
                          <Badge
                            variant="outline"
                            className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px]"
                          >
                            Entrada Manual
                          </Badge>
                        )}
                        {adj.type === 'return' && (
                          <Badge
                            variant="outline"
                            className="bg-purple-50 text-purple-700 border-purple-200 text-[11px]"
                          >
                            Devolução
                          </Badge>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-slate-600 whitespace-nowrap text-xs">
                        {adj.quantity_before !== undefined ? `${adj.quantity_before} un` : '—'}
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-xs font-bold font-mono ${
                            isPositive
                              ? 'bg-emerald-100 text-emerald-800'
                              : isNegative
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {isPositive && <ArrowUpRight className="w-3.5 h-3.5" />}
                          {isNegative && <ArrowDownRight className="w-3.5 h-3.5" />}
                          {isPositive ? `+${adj.quantity_change}` : adj.quantity_change} un
                        </span>
                      </td>

                      <td
                        className="py-3 px-4 text-xs text-slate-700 max-w-xs truncate"
                        title={adj.reason}
                      >
                        {adj.reason || 'Sem justificativa preenchida.'}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-600">
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" />
                          <span>{adj.expand?.user_id?.name || 'Sistema'}</span>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* ADJUSTMENT MODAL */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-slate-700" />
              Lançar Ajuste ou Contagem Física
            </DialogTitle>
            <DialogDescription>
              Ajuste o saldo do lote com base na contagem física ou lançamento de correção.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveAdjustment} className="space-y-4 py-2">
            {/* Lote Selection */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Lote a ser Ajustado *</Label>
              <Select value={selectedBatchId} onValueChange={handleBatchSelect}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Selecione o lote" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {batches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.batch_number} — {b.expand?.product_id?.name} (Saldo: {b.quantity} un)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Current Batch Info Bar */}
            {targetBatch && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs flex items-center justify-between">
                <div>
                  <span className="text-slate-500 block">Equipamento:</span>
                  <strong className="text-slate-900">
                    {targetBatch.expand?.product_id?.name} ({targetBatch.expand?.product_id?.sku})
                  </strong>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block">Saldo Atual no Sistema:</span>
                  <strong className="text-slate-900 font-mono text-sm">
                    {targetBatch.quantity} un
                  </strong>
                </div>
              </div>
            )}

            {/* Tipo de Ajuste */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Tipo de Operação *</Label>
              <Select value={adjType} onValueChange={(val: any) => setAdjType(val)}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="count_adjustment">
                    Contagem Física de Inventário (Informa a quantidade real total)
                  </SelectItem>
                  <SelectItem value="manual_entry">
                    Entrada Manual / Adição de Saldo (+ un)
                  </SelectItem>
                  <SelectItem value="return">
                    Devolução de Venda / Reentrada de Equipamento
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Values input based on type */}
            {adjType === 'count_adjustment' ? (
              <div className="space-y-1">
                <Label htmlFor="adjPhys" className="text-xs font-bold text-slate-700">
                  Quantidade Física Real Contada (Unidades) *
                </Label>
                <Input
                  id="adjPhys"
                  type="number"
                  min="0"
                  value={physicalCount}
                  onChange={(e) => setPhysicalCount(parseInt(e.target.value) || 0)}
                  className="font-mono text-base font-bold"
                  required
                />
              </div>
            ) : (
              <div className="space-y-1">
                <Label htmlFor="adjChange" className="text-xs font-bold text-slate-700">
                  Quantidade a Adicionar ao Lote (Unidades) *
                </Label>
                <Input
                  id="adjChange"
                  type="number"
                  min="1"
                  value={manualChange}
                  onChange={(e) => setManualChange(parseInt(e.target.value) || 0)}
                  className="font-mono text-base font-bold"
                  required
                />
              </div>
            )}

            {/* Divergence calculation preview box */}
            {targetBatch && (
              <div
                className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                  calculatedDiscrepancy === 0
                    ? 'bg-slate-50 border-slate-200 text-slate-700'
                    : calculatedDiscrepancy > 0
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                <div>
                  <span className="font-bold block">
                    {calculatedDiscrepancy === 0
                      ? 'Nenhuma alteração de saldo detectada'
                      : calculatedDiscrepancy > 0
                        ? 'Entrada no estoque (Sobra ou Adição)'
                        : 'Baixa no estoque (Falta física)'}
                  </span>
                  <span className="text-[11px] opacity-80">
                    Saldo Resultante: <strong>{projectedNewTotal} unidades</strong> no lote{' '}
                    {targetBatch.batch_number}.
                  </span>
                </div>
                <div className="text-lg font-bold font-mono">
                  {calculatedDiscrepancy > 0 ? `+${calculatedDiscrepancy}` : calculatedDiscrepancy}{' '}
                  un
                </div>
              </div>
            )}

            {/* Justificativa */}
            <div className="space-y-1">
              <Label htmlFor="adjReason" className="text-xs font-semibold text-slate-700">
                Motivo / Justificativa do Ajuste *
              </Label>
              <Textarea
                id="adjReason"
                placeholder="Ex: Auditoria semestral de estoque, devolução do cliente NF-e 4920..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setModalOpen(false)}
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
                    Processando...
                  </>
                ) : (
                  'Confirmar Ajuste'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
