import React, { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Boxes,
  Plus,
  DollarSign,
  TrendingUp,
  Wrench,
  CheckCircle2,
  Clock,
  Layers,
  Laptop,
  Check,
  AlertCircle,
  AlertTriangle,
  FileText,
  Calendar,
  ChevronRight,
  ExternalLink,
  Edit2,
  Trash2,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { purchaseBatchesService } from '@/services/purchaseBatches'
import { productsService } from '@/services/products'
import { equipmentService } from '@/services/equipment'
import type { PurchaseBatch, Product, EquipmentPart } from '@/types/inventory'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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

export default function LoteEntradaDetalhe() {
  const { id } = useParams<{ id: string }>()
  const [batch, setBatch] = useState<PurchaseBatch | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [parts, setParts] = useState<EquipmentPart[]>([])
  const [loading, setLoading] = useState(true)

  const { toast } = useToast()
  const { isAdmin } = useAuth()
  const navigate = useNavigate()

  // Modal de Adicionar / Editar Peça
  const [partModalOpen, setPartModalOpen] = useState(false)
  const [editingPart, setEditingPart] = useState<EquipmentPart | null>(null)
  const [partName, setPartName] = useState('')
  const [partCost, setPartCost] = useState<number>(0)
  const [partSupplier, setPartSupplier] = useState('')
  const [partPurchaseDate, setPartPurchaseDate] = useState('')
  const [partProductId, setPartProductId] = useState<string>('batch') // 'batch' ou ID de produto
  const [partStatus, setPartStatus] = useState<'Pendente' | 'Trocado' | 'Instalado' | 'Danificado'>(
    'Instalado',
  )
  const [partNotes, setPartNotes] = useState('')
  const [savingPart, setSavingPart] = useState(false)

  // Diálogo de Confirmação para Remover Peça
  const [partToDelete, setPartToDelete] = useState<EquipmentPart | null>(null)
  const [deletingPart, setDeletingPart] = useState(false)

  const loadData = async () => {
    if (!id) return
    try {
      const batchData = await purchaseBatchesService.getById(id)
      setBatch(batchData)

      const batchProducts = await purchaseBatchesService.getProductsByBatchId(id)
      setProducts(batchProducts)

      // 1. Get parts directly linked to this batch
      const batchDirectParts = await equipmentService.getPartsByBatch(id)

      // 2. Get parts linked to the products of this batch
      const productPartsPromises = batchProducts.map((p) =>
        equipmentService.getPartsByProduct(p.id),
      )
      const productPartsResults = await Promise.all(productPartsPromises)
      const allProductParts = productPartsResults.flat()

      // Merge avoiding duplicates (a part might have both purchase_batch_id and product_id)
      const seen = new Set<string>()
      const mergedParts: EquipmentPart[] = []
      for (const p of [...batchDirectParts, ...allProductParts]) {
        if (!seen.has(p.id)) {
          seen.add(p.id)
          mergedParts.push(p)
        }
      }
      setParts(mergedParts)
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao carregar detalhes do lote',
        description: err?.message || 'Lote não encontrado.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  // Calculations
  const expectedQty = Number(batch?.expected_quantity) || 1
  const inventoriedCount = products.length
  const missingCount = Math.max(0, expectedQty - inventoriedCount)
  const progressPct = Math.min(100, Math.round((inventoriedCount / expectedQty) * 100))

  const acquisitionCost = Number(batch?.total_cost) || 0
  const partsAndServicesCost = parts.reduce((acc, part) => acc + (Number(part.cost) || 0), 0)
  const totalCostOverall = acquisitionCost + partsAndServicesCost
  const averageUnitCost = expectedQty > 0 ? totalCostOverall / expectedQty : 0

  // Estimated sales revenue and profit/deficit
  const totalTargetSales = products.reduce((acc, p) => acc + (Number(p.unit_price) || 0), 0)
  const estimatedProfit = totalTargetSales - totalCostOverall

  const handleOpenAddPartModal = () => {
    setEditingPart(null)
    setPartName('')
    setPartCost(0)
    setPartSupplier(batch?.supplier || '')
    setPartPurchaseDate(new Date().toISOString().split('T')[0])
    setPartProductId('batch')
    setPartStatus('Instalado')
    setPartNotes('')
    setPartModalOpen(true)
  }

  const handleOpenEditPartModal = (part: EquipmentPart) => {
    setEditingPart(part)
    setPartName(part.name || '')
    setPartCost(Number(part.cost) || 0)
    setPartSupplier(part.supplier || '')
    setPartPurchaseDate(part.purchase_date ? part.purchase_date.split(' ')[0].split('T')[0] : '')
    setPartProductId(part.product_id || 'batch')
    setPartStatus(part.status || 'Instalado')
    setPartNotes(part.notes || '')
    setPartModalOpen(true)
  }

  const handleSavePart = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !partName.trim()) return

    setSavingPart(true)
    try {
      const payload: any = {
        name: partName.trim(),
        cost: Number(partCost) || 0,
        supplier: partSupplier.trim(),
        purchase_date: partPurchaseDate ? new Date(partPurchaseDate).toISOString() : undefined,
        status: partStatus,
        notes: partNotes.trim(),
        purchase_batch_id: id,
        product_id: partProductId !== 'batch' ? partProductId : null,
      }

      if (editingPart) {
        await equipmentService.updatePart(editingPart.id, payload)
        toast({
          title: 'Peça atualizada!',
          description: 'Os dados e custos da peça foram atualizados.',
        })
      } else {
        await equipmentService.createPart(payload)
        toast({
          title: 'Peça adicionada!',
          description: 'A peça foi vinculada ao custo do lote.',
        })
      }

      setPartModalOpen(false)
      await loadData()
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao salvar peça',
        description: err?.message || 'Falha ao gravar os dados da peça.',
        variant: 'destructive',
      })
    } finally {
      setSavingPart(false)
    }
  }

  const handleConfirmDeletePart = async () => {
    if (!partToDelete) return
    setDeletingPart(true)
    try {
      await equipmentService.deletePart(partToDelete.id)
      toast({
        title: 'Peça removida',
        description: 'A peça e o respectivo custo foram excluídos.',
      })
      setPartToDelete(null)
      await loadData()
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao remover peça',
        description: err?.message,
        variant: 'destructive',
      })
    } finally {
      setDeletingPart(false)
    }
  }

  const handleToggleStatus = async () => {
    if (!batch) return
    const nextStatus = batch.status === 'concluido' ? 'em_processamento' : 'concluido'
    try {
      const updated = await purchaseBatchesService.update(batch.id, { status: nextStatus })
      setBatch(updated)
      toast({
        title: nextStatus === 'concluido' ? 'Lote concluído!' : 'Lote reaberto',
        description: `O status do lote foi alterado para ${
          nextStatus === 'concluido' ? 'Concluído' : 'Em processamento'
        }.`,
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao alterar status',
        description: err?.message,
        variant: 'destructive',
      })
    }
  }

  if (loading) {
    return (
      <div className="p-16 text-center max-w-7xl mx-auto">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600 mx-auto" />
        <p className="mt-3 text-sm text-slate-500">Carregando detalhes do lote...</p>
      </div>
    )
  }

  if (!batch) {
    return (
      <div className="max-w-7xl mx-auto text-center py-16">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-800">Lote de Entrada não encontrado</h2>
        <p className="text-sm text-slate-500 mt-1 mb-6">
          O lote solicitado não existe ou foi removido.
        </p>
        <Link to="/lotes-entrada">
          <Button variant="outline">Voltar para Lotes de Entrada</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 font-sans">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
            <Link
              to="/lotes-entrada"
              className="hover:text-orange-600 font-medium flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Lotes de Entrada
            </Link>
            <span>/</span>
            <span className="font-mono text-slate-700">
              {batch.invoice_number ? `NF ${batch.invoice_number}` : batch.supplier}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              {batch.supplier}
            </h1>
            {batch.status === 'concluido' ? (
              <Badge className="bg-emerald-100 text-emerald-800 border-none font-medium hover:bg-emerald-100">
                Concluído
              </Badge>
            ) : (
              <Badge className="bg-amber-100 text-amber-800 border-none font-medium hover:bg-amber-100">
                Em processamento
              </Badge>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
            {batch.invoice_number && (
              <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-700 text-xs">
                Nota Fiscal: {batch.invoice_number}
              </span>
            )}
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <Calendar className="w-3.5 h-3.5" />
              Adquirido em:{' '}
              {batch.purchase_date
                ? new Date(batch.purchase_date).toLocaleDateString('pt-BR')
                : new Date(batch.created).toLocaleDateString('pt-BR')}
            </span>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleToggleStatus}
            className="text-xs h-10 border-slate-300"
          >
            {batch.status === 'concluido' ? 'Reabrir Lote' : 'Marcar como Concluído'}
          </Button>

          <Link to={`/lotes-entrada/${batch.id}/inventariar`}>
            <Button className="bg-[#d9532f] hover:bg-[#c24624] text-white shadow-sm gap-2 h-10 font-semibold px-4">
              <Plus className="w-4 h-4" />+ Inventariar equipamento
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards (Baseados na Tela 3) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Custo Aquisição */}
        <Card className="border-slate-200 shadow-xs bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Custo Aquisição
              </span>
              <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold text-slate-900">
                {acquisitionCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <p className="text-xs text-slate-400 mt-1">Valor base da nota / compra</p>
            </div>
          </CardContent>
        </Card>

        {/* KPI 2: Custos Peças/Serviços */}
        <Card className="border-slate-200 shadow-xs bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Custos Peças / Serviços
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Wrench className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold text-slate-900">
                {partsAndServicesCost.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {parts.length} peça(s) instalada(s) no lote
              </p>
            </div>
          </CardContent>
        </Card>

        {/* KPI 3: Custo Médio Unitário */}
        <Card className="border-slate-200 shadow-xs bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Custo Médio Unitário
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold text-slate-900">
                {averageUnitCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Sugerido para {expectedQty} equipamento(s)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* KPI 4: Lucro / Déficit Estimado */}
        <Card className="border-slate-200 shadow-xs bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Lucro / Déficit Estimado
              </span>
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  estimatedProfit >= 0
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-rose-50 text-rose-600'
                }`}
              >
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <div
                className={`text-2xl font-bold ${
                  estimatedProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {estimatedProfit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Venda total:{' '}
                {totalTargetSales.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Triagem Progress Bar Banner */}
      <Card className="border-slate-200 bg-white shadow-xs overflow-hidden">
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <div>
              <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#d9532f]" />
                Progresso de Triagem e Testes
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {inventoriedCount} de {expectedQty} equipamentos cadastrados e inspecionados.
                {missingCount > 0 ? (
                  <span className="text-[#d9532f] font-semibold ml-1">
                    Faltam {missingCount} equipamentos para concluir este lote.
                  </span>
                ) : (
                  <span className="text-emerald-600 font-semibold ml-1">
                    Todos os itens esperados foram inventariados!
                  </span>
                )}
              </p>
            </div>
            <div className="text-right">
              <span className="text-xl font-extrabold text-[#d9532f]">{progressPct}%</span>
            </div>
          </div>

          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                progressPct >= 100 ? 'bg-emerald-500' : 'bg-[#d9532f]'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Seção Peças & Custos Vinculada ao Lote */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Wrench className="w-5 h-5 text-orange-600" />
                Peças & Custos do Lote ({parts.length})
              </h2>
              <Badge variant="outline" className="text-xs">
                {partsAndServicesCost.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Peças adquiridas para upgrade, reparo ou manutenção geral do lote ou de equipamentos
              específicos.
            </p>
          </div>

          <Button
            size="sm"
            onClick={handleOpenAddPartModal}
            className="bg-[#d9532f] hover:bg-[#c24624] text-white shadow-xs text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />+ Adicionar Peça / Custo
          </Button>
        </div>

        {parts.length === 0 ? (
          <Card className="border-dashed border-2 border-slate-200 bg-white">
            <CardContent className="py-10 text-center">
              <Wrench className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h3 className="font-semibold text-slate-700 text-sm">
                Nenhuma peça ou custo extra registrado neste lote
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                Adicione memórias, SSDs, telas ou peças de reposição para compor o custo real do
                lote.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenAddPartModal}
                className="mt-3 text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Registrar primeira peça
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Peça / Componente</th>
                    <th className="py-3 px-4">Vinculado a</th>
                    <th className="py-3 px-4">Fornecedor</th>
                    <th className="py-3 px-4">Data</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Custo</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parts.map((p) => {
                    const linkedProduct = products.find((prod) => prod.id === p.product_id)
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">{p.name}</div>
                          {p.notes && <div className="text-xs text-slate-400">{p.notes}</div>}
                        </td>

                        <td className="py-3.5 px-4 text-xs">
                          {linkedProduct ? (
                            <Link
                              to={`/catalogo/${linkedProduct.sku || linkedProduct.code || linkedProduct.id}`}
                              className="text-orange-600 hover:underline font-medium inline-flex items-center gap-1"
                            >
                              {linkedProduct.name}
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          ) : (
                            <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded font-medium">
                              Lote Geral
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-xs text-slate-600">{p.supplier || '—'}</td>

                        <td className="py-3.5 px-4 text-xs text-slate-500">
                          {p.purchase_date
                            ? new Date(p.purchase_date).toLocaleDateString('pt-BR')
                            : p.created
                              ? new Date(p.created).toLocaleDateString('pt-BR')
                              : '—'}
                        </td>

                        <td className="py-3.5 px-4">
                          <Badge
                            variant="outline"
                            className={`text-xs font-normal border-none ${
                              p.status === 'Instalado'
                                ? 'bg-emerald-100 text-emerald-800'
                                : p.status === 'Trocado'
                                  ? 'bg-blue-100 text-blue-800'
                                  : p.status === 'Danificado'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {p.status || 'Instalado'}
                          </Badge>
                        </td>

                        <td className="py-3.5 px-4 font-semibold text-slate-900 text-xs">
                          {(Number(p.cost) || 0).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-slate-500 hover:text-orange-600"
                              onClick={() => handleOpenEditPartModal(p)}
                              title="Editar peça"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-slate-500 hover:text-rose-600"
                              onClick={() => setPartToDelete(p)}
                              title="Remover peça"
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
      </div>

      {/* Tabela de Equipamentos Já Inventariados Neste Lote */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">
              Equipamentos no Lote ({inventoriedCount})
            </h2>
            <Badge variant="outline" className="text-xs">
              {inventoriedCount} / {expectedQty}
            </Badge>
          </div>

          <Link to={`/lotes-entrada/${batch.id}/inventariar`}>
            <Button
              size="sm"
              className="bg-[#d9532f] hover:bg-[#c24624] text-white shadow-xs text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />+ Inventariar equipamento
            </Button>
          </Link>
        </div>

        {products.length === 0 ? (
          <Card className="border-dashed border-2 border-slate-200 bg-white">
            <CardContent className="py-12 text-center">
              <Laptop className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="font-semibold text-slate-700">
                Nenhum equipamento inventariado ainda
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                Clique no botão abaixo para preencher a ficha de inventário do primeiro equipamento
                deste lote.
              </p>
              <Link to={`/lotes-entrada/${batch.id}/inventariar`}>
                <Button className="mt-4 bg-[#d9532f] hover:bg-[#c24624] text-white text-xs">
                  <Plus className="w-3.5 h-3.5 mr-1" />+ Inventariar Primeiro Equipamento
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Equipamento</th>
                    <th className="py-3 px-4">Serial / SKU</th>
                    <th className="py-3 px-4">Configuração</th>
                    <th className="py-3 px-4">Estética / Bateria</th>
                    <th className="py-3 px-4">Carregador</th>
                    <th className="py-3 px-4">Custo Base</th>
                    <th className="py-3 px-4">Preço Venda</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map((p) => {
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">{p.name}</div>
                          <div className="text-xs text-slate-400">
                            {p.brand} {p.model ? `• ${p.model}` : ''}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-mono text-xs">
                          <div className="text-slate-800 font-semibold">
                            {p.serial_number || p.sku}
                          </div>
                          {p.code && <div className="text-[11px] text-slate-400">{p.code}</div>}
                        </td>

                        <td className="py-3.5 px-4 text-xs text-slate-600">
                          <div>{p.processor || 'Não inf.'}</div>
                          <div className="text-slate-400">
                            {p.ram || '8GB'} • {p.storage || 'SSD 256GB'}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-xs">
                          <div className="font-medium text-slate-800">
                            {p.aesthetic_grade || p.condition || 'Bom'}
                          </div>
                          <div className="text-slate-400">Bat: {p.battery_health || 'OK'}</div>
                        </td>

                        <td className="py-3.5 px-4 text-xs">
                          {p.includes_charger ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Sim
                            </span>
                          ) : (
                            <span className="text-slate-400">Não</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 font-medium text-slate-800 text-xs">
                          {(Number(p.cost_price) || 0).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </td>

                        <td className="py-3.5 px-4 font-semibold text-emerald-700 text-xs">
                          {(Number(p.unit_price) || 0).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </td>

                        <td className="py-3.5 px-4">
                          <Badge
                            variant="outline"
                            className={`text-xs font-normal border-none ${
                              p.status === 'Disponível'
                                ? 'bg-emerald-100 text-emerald-800'
                                : p.status === 'Reservado'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {p.status || 'Disponível'}
                          </Badge>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <Link
                            to={`/catalogo/${p.sku || p.code || p.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 rounded transition-colors"
                          >
                            Ver Ficha
                            <ExternalLink className="w-3 h-3" />
                          </Link>
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

      {/* Modal Adicionar / Editar Peça */}
      <Dialog open={partModalOpen} onOpenChange={setPartModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingPart ? 'Editar Peça / Custo' : 'Adicionar Peça ao Lote'}
            </DialogTitle>
            <DialogDescription>
              Vincule peças de reposição, upgrades ou custos de manutenção a este lote.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSavePart} className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold text-slate-700">Nome da Peça *</Label>
              <Input
                required
                value={partName}
                onChange={(e) => setPartName(e.target.value)}
                placeholder="Ex: Memória RAM 16GB DDR4, SSD 512GB NVMe, Bateria Dell"
                className="mt-1 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Custo da Peça (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={partCost}
                  onChange={(e) => setPartCost(parseFloat(e.target.value) || 0)}
                  placeholder="0,00"
                  className="mt-1 text-sm"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Status</Label>
                <Select value={partStatus} onValueChange={(val: any) => setPartStatus(val)}>
                  <SelectTrigger className="mt-1 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Instalado">Instalado</SelectItem>
                    <SelectItem value="Trocado">Trocado</SelectItem>
                    <SelectItem value="Pendente">Pendente</SelectItem>
                    <SelectItem value="Danificado">Danificado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">Equipamento Destino</Label>
              <Select value={partProductId} onValueChange={(val) => setPartProductId(val)}>
                <SelectTrigger className="mt-1 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="batch">Lote Geral (Custo compartilhado no lote)</SelectItem>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.serial_number || p.sku || 'Sem serial'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-slate-400 mt-1">
                Você pode vincular diretamente a um notebook do lote ou deixar como custo geral do
                lote.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Fornecedor da Peça</Label>
                <Input
                  value={partSupplier}
                  onChange={(e) => setPartSupplier(e.target.value)}
                  placeholder="Ex: Mercado Livre, KaBuM!"
                  className="mt-1 text-sm"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Data da Compra</Label>
                <Input
                  type="date"
                  value={partPurchaseDate}
                  onChange={(e) => setPartPurchaseDate(e.target.value)}
                  className="mt-1 text-sm"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">Observações / Detalhes</Label>
              <Textarea
                rows={2}
                value={partNotes}
                onChange={(e) => setPartNotes(e.target.value)}
                placeholder="Ex: Peça nova com garantia de 3 meses, instalada no slot secundário"
                className="mt-1 text-sm"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPartModalOpen(false)}
                disabled={savingPart}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-[#d9532f] hover:bg-[#c24624] text-white font-medium"
                disabled={savingPart}
              >
                {savingPart ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : editingPart ? (
                  'Salvar Alterações'
                ) : (
                  'Adicionar Peça'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmação de Exclusão de Peça */}
      <AlertDialog open={!!partToDelete} onOpenChange={(open) => !open && setPartToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover peça / custo?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza de que deseja remover a peça &quot;{partToDelete?.name}&quot; no valor de{' '}
              {(Number(partToDelete?.cost) || 0).toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })}
              ? Esta ação deduzirá o custo do lote e não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingPart}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleConfirmDeletePart()
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold"
              disabled={deletingPart}
            >
              {deletingPart ? 'Removendo...' : 'Sim, remover peça'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
