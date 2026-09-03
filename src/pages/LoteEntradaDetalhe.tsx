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

export default function LoteEntradaDetalhe() {
  const { id } = useParams<{ id: string }>()
  const [batch, setBatch] = useState<PurchaseBatch | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [parts, setParts] = useState<EquipmentPart[]>([])
  const [loading, setLoading] = useState(true)

  const { toast } = useToast()
  const { isAdmin } = useAuth()
  const navigate = useNavigate()

  const loadData = async () => {
    if (!id) return
    try {
      const batchData = await purchaseBatchesService.getById(id)
      setBatch(batchData)

      const batchProducts = await purchaseBatchesService.getProductsByBatchId(id)
      setProducts(batchProducts)

      // Get parts for all products in this batch to calculate repair/service costs
      const partsPromises = batchProducts.map((p) => equipmentService.getPartsByProduct(p.id))
      const partsResults = await Promise.all(partsPromises)
      setParts(partsResults.flat())
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
  const averageUnitCost = expectedQty > 0 ? acquisitionCost / expectedQty : 0

  // Estimated sales revenue and profit/deficit
  const totalTargetSales = products.reduce((acc, p) => acc + (Number(p.unit_price) || 0), 0)
  const estimatedProfit = totalTargetSales - totalCostOverall

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
    </div>
  )
}
