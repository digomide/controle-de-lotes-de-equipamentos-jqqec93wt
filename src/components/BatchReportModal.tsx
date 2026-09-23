import React, { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  FileText,
  Printer,
  DollarSign,
  TrendingUp,
  Boxes,
  PieChart as PieChartIcon,
  BarChart3,
  Layers,
  Wrench,
  CheckCircle2,
  Clock,
  AlertCircle,
  Tag,
  Building2,
  Calendar,
  Sparkles,
  ExternalLink,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import type { PurchaseBatch, Product, EquipmentPart } from '@/types/inventory'
import {
  getBatchReportGroupKey,
  resolveEquipmentBrand,
  resolveEquipmentModel,
} from '@/utils/equipmentGrouping'

export interface BatchReportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  batch: PurchaseBatch | null
  products: Product[]
  parts: EquipmentPart[]
  tenantName?: string
}

export interface ModelGroupSummary {
  modelKey: string
  name: string
  brand: string
  model: string
  specs: string
  count: number
  availableCount: number
  reservedCount: number
  pendingCount: number
  soldCount: number
  avgEffectiveCost: number
  avgUnitPrice: number
  avgEstimatedProfit: number
  avgMarginPct: number
  totalRevenue: number
  totalCost: number
  totalProfit: number
}

const STATUS_COLORS: Record<string, string> = {
  Disponível: '#10b981', // emerald-500
  Reservado: '#3b82f6', // blue-500
  'Pendente de ativação': '#f59e0b', // amber-500
  Vendido: '#64748b', // slate-500
}

export function BatchReportModal({
  open,
  onOpenChange,
  batch,
  products,
  parts,
  tenantName,
}: BatchReportModalProps) {
  const [activeTab, setActiveTab] = useState<'kpis' | 'charts' | 'models' | 'parts'>('kpis')
  const [generatedAt] = useState<Date>(() => new Date())

  // --- CÁLCULOS FINANCEIROS E CONSOLIDAÇÃO DO LOTE ---
  const expectedQty = Number(batch?.expected_quantity) || 1
  const inventoriedCount = products.length
  const divisorEquipamentos = products.length > 0 ? products.length : expectedQty

  const acquisitionCost = Number(batch?.total_cost) || 0
  const partsAndServicesCost = parts.reduce(
    (acc, part) => acc + (Number(part.cost) || 0) * (Number(part.quantity) || 1),
    0,
  )
  const totalPartsQuantity = parts.reduce((acc, part) => acc + (Number(part.quantity) || 1), 0)
  const totalConsolidatedCost = acquisitionCost + partsAndServicesCost

  const partsSharePerNotebook =
    divisorEquipamentos > 0 ? partsAndServicesCost / divisorEquipamentos : 0

  // Custo base por item esperado
  const baseCostPerExpectedItem = expectedQty > 0 ? acquisitionCost / expectedQty : 0
  // Custo efetivo médio consolidado
  const averageUnitEffectiveCost =
    divisorEquipamentos > 0 ? totalConsolidatedCost / divisorEquipamentos : 0

  // Status breakdown
  const statusCounts = useMemo(() => {
    let disponivel = 0
    let reservado = 0
    let pendente = 0
    let vendido = 0

    products.forEach((p) => {
      if (p.status === 'Disponível') disponivel++
      else if (p.status === 'Reservado') reservado++
      else if (p.status === 'Pendente de ativação') pendente++
      else if (p.status === 'Vendido') vendido++
      else disponivel++
    })

    return {
      disponivel,
      reservado,
      pendente,
      vendido,
      total: products.length,
    }
  }, [products])

  // Receitas e Lucros
  const financialTotals = useMemo(() => {
    let totalTargetSales = 0
    let potentialAvailableSales = 0
    let totalEffectiveCost = 0

    products.forEach((p) => {
      const price = Number(p.unit_price) || 0
      totalTargetSales += price

      if (p.status === 'Disponível') {
        potentialAvailableSales += price
      }

      const rawCost = Number(p.cost_price) || 0
      const baseCost =
        rawCost > 0 ? rawCost : divisorEquipamentos > 0 ? acquisitionCost / divisorEquipamentos : 0
      totalEffectiveCost += baseCost + partsSharePerNotebook
    })

    // Se nenhum item foi inventariado ainda, usa o totalConsolidatedCost do lote
    const costReference = products.length > 0 ? totalEffectiveCost : totalConsolidatedCost
    const estimatedProfit = totalTargetSales - costReference
    const marginPct =
      costReference > 0 ? (estimatedProfit / costReference) * 100 : totalTargetSales > 0 ? 100 : 0
    const grossMarginPct = totalTargetSales > 0 ? (estimatedProfit / totalTargetSales) * 100 : 0

    return {
      totalTargetSales,
      potentialAvailableSales,
      totalEffectiveCost: costReference,
      estimatedProfit,
      marginPct,
      grossMarginPct,
    }
  }, [products, divisorEquipamentos, acquisitionCost, partsSharePerNotebook, totalConsolidatedCost])

  // Agrupamento por Modelo para relatórios e gráficos
  const groupedModels = useMemo<ModelGroupSummary[]>(() => {
    const map = new Map<string, Product[]>()

    products.forEach((p) => {
      const key = getBatchReportGroupKey(p)

      if (!map.has(key)) {
        map.set(key, [])
      }
      map.get(key)!.push(p)
    })

    const groups: ModelGroupSummary[] = []

    map.forEach((items, modelKey) => {
      const first = items[0]
      const count = items.length

      const availableCount = items.filter((i) => i.status === 'Disponível').length
      const reservedCount = items.filter((i) => i.status === 'Reservado').length
      const pendingCount = items.filter((i) => i.status === 'Pendente de ativação').length
      const soldCount = items.filter((i) => i.status === 'Vendido').length

      const sumPrice = items.reduce((acc, i) => acc + (Number(i.unit_price) || 0), 0)
      const avgUnitPrice = count > 0 ? sumPrice / count : 0

      // Custo efetivo de cada item no grupo
      let sumCost = 0
      items.forEach((i) => {
        const c = Number(i.cost_price) || 0
        const base = c > 0 ? c : divisorEquipamentos > 0 ? acquisitionCost / divisorEquipamentos : 0
        sumCost += base + partsSharePerNotebook
      })

      const avgEffectiveCost = count > 0 ? sumCost / count : 0
      const totalProfit = sumPrice - sumCost
      const avgEstimatedProfit = count > 0 ? totalProfit / count : 0
      const avgMarginPct = sumCost > 0 ? (totalProfit / sumCost) * 100 : 0

      const specsParts = [first.processor, first.ram, first.storage, first.screen_size].filter(
        Boolean,
      )

      const resolvedBrand = resolveEquipmentBrand(first)
      const resolvedModel = resolveEquipmentModel(first)

      const displayName =
        first.name ||
        (resolvedBrand !== 'Não inf.' && resolvedModel !== 'Modelo não informado'
          ? `${resolvedBrand} ${resolvedModel}`
          : first.name || 'Equipamento')

      groups.push({
        modelKey,
        name: displayName,
        brand: resolvedBrand,
        model: resolvedModel,
        specs: specsParts.join(' • ') || 'Configuração padrão',
        count,
        availableCount,
        reservedCount,
        pendingCount,
        soldCount,
        avgEffectiveCost,
        avgUnitPrice,
        avgEstimatedProfit,
        avgMarginPct,
        totalRevenue: sumPrice,
        totalCost: sumCost,
        totalProfit,
      })
    })

    return groups.sort((a, b) => b.count - a.count)
  }, [products, divisorEquipamentos, acquisitionCost, partsSharePerNotebook])

  // --- DADOS PARA OS GRÁFICOS RECHARTS ---
  // a) Distribuição por Status (rosca)
  const statusPieData = useMemo(() => {
    const data = [
      { name: 'Disponível', value: statusCounts.disponivel, color: STATUS_COLORS.Disponível },
      { name: 'Reservado', value: statusCounts.reservado, color: STATUS_COLORS.Reservado },
      {
        name: 'Pendente de ativação',
        value: statusCounts.pendente,
        color: STATUS_COLORS['Pendente de ativação'],
      },
      { name: 'Vendido', value: statusCounts.vendido, color: STATUS_COLORS.Vendido },
    ]
    return data.filter((d) => d.value > 0)
  }, [statusCounts])

  // b) Composição do Custo (Aquisição vs Peças)
  const costBreakdownData = useMemo(() => {
    return [
      { name: 'Aquisição Equipamentos', value: acquisitionCost, color: '#d9532f' },
      { name: 'Peças & Reposição', value: partsAndServicesCost, color: '#f59e0b' },
    ].filter((d) => d.value > 0)
  }, [acquisitionCost, partsAndServicesCost])

  // c) Estimativa de Receita vs Custo por Grupo de Modelo (Top 6 modelos para caber perfeitamente)
  const modelRevenueVsCostData = useMemo(() => {
    return groupedModels.slice(0, 6).map((g) => ({
      name: g.model || g.name.slice(0, 18),
      Receita: Math.round(g.totalRevenue),
      Custo: Math.round(g.totalCost),
      Lucro: Math.round(g.totalProfit),
    }))
  }, [groupedModels])

  // d) Margem % por Modelo (Top modelos ordenados por volume)
  const modelMarginData = useMemo(() => {
    return groupedModels.slice(0, 8).map((g) => ({
      name: g.model || g.name.slice(0, 16),
      margem: Number(g.avgMarginPct.toFixed(1)),
      color: g.avgMarginPct >= 25 ? '#10b981' : g.avgMarginPct >= 10 ? '#f59e0b' : '#ef4444',
    }))
  }, [groupedModels])

  const formatBRL = (val: number) =>
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const handlePrint = () => {
    window.print()
  }

  if (!batch) return null

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[94vh] flex flex-col p-0 overflow-hidden bg-slate-50 border-slate-300">
          {/* HEADER DO MODAL */}
          <DialogHeader className="p-4 sm:p-5 bg-white border-b border-slate-200 shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="w-8 h-8 rounded-lg bg-orange-100 text-[#d9532f] flex items-center justify-center font-bold">
                    <FileText className="w-4 h-4" />
                  </div>
                  <DialogTitle className="text-xl font-extrabold text-slate-900 tracking-tight">
                    Relatório Executivo do Lote
                  </DialogTitle>
                  <Badge className="bg-[#d9532f] text-white border-none font-bold text-xs">
                    {batch.invoice_number ? `NF ${batch.invoice_number}` : batch.supplier}
                  </Badge>
                  {tenantName && (
                    <Badge variant="outline" className="bg-slate-100 text-slate-700 text-xs">
                      <Building2 className="w-3 h-3 mr-1 text-slate-400" />
                      {tenantName}
                    </Badge>
                  )}
                </div>
                <DialogDescription className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                  <span>
                    Fornecedor: <strong>{batch.supplier}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Data de Entrada:{' '}
                    {batch.purchase_date
                      ? new Date(batch.purchase_date).toLocaleDateString('pt-BR')
                      : new Date(batch.created).toLocaleDateString('pt-BR')}
                  </span>
                  <span>•</span>
                  <span>Gerado em: {generatedAt.toLocaleString('pt-BR')}</span>
                </DialogDescription>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={handlePrint}
                  className="bg-[#d9532f] hover:bg-[#c24624] text-white text-xs h-9 font-semibold gap-1.5 shadow-xs"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir / Salvar PDF
                </Button>
              </div>
            </div>

            {/* ABAS DO MODAL */}
            <div className="pt-2">
              <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)}>
                <TabsList className="bg-slate-100 p-1">
                  <TabsTrigger value="kpis" className="text-xs font-semibold gap-1.5">
                    <DollarSign className="w-3.5 h-3.5" /> Visão Geral & KPIs
                  </TabsTrigger>
                  <TabsTrigger value="charts" className="text-xs font-semibold gap-1.5">
                    <BarChart3 className="w-3.5 h-3.5" /> Gráficos Analíticos
                  </TabsTrigger>
                  <TabsTrigger value="models" className="text-xs font-semibold gap-1.5">
                    <Boxes className="w-3.5 h-3.5" /> Modelos ({groupedModels.length})
                  </TabsTrigger>
                  <TabsTrigger value="parts" className="text-xs font-semibold gap-1.5">
                    <Wrench className="w-3.5 h-3.5" /> Peças & Rateio ({parts.length})
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </DialogHeader>

          {/* CORPO DO MODAL */}
          <div className="p-4 sm:p-6 flex-1 overflow-y-auto space-y-5">
            {/* TAB 1: VISÃO GERAL & KPIS */}
            {activeTab === 'kpis' && (
              <div className="space-y-5">
                {/* 6 KPIs PRINCIPAIS */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {/* KPI 1: Qtd Equipamentos */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                      Equipamentos
                    </span>
                    <div className="text-2xl font-black text-slate-900 mt-1">
                      {inventoriedCount}{' '}
                      <span className="text-xs font-normal text-slate-400">/ {expectedQty}</span>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      {statusCounts.disponivel} disponível(is)
                    </span>
                  </div>

                  {/* KPI 2: Custo Consolidado */}
                  <div className="bg-white p-3.5 rounded-xl border border-orange-200/80 shadow-xs">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                      Custo Consolidado
                    </span>
                    <div className="text-xl font-black text-slate-900 mt-1">
                      {formatBRL(totalConsolidatedCost)}
                    </div>
                    <span className="text-[11px] text-amber-700 font-medium">
                      + {formatBRL(partsAndServicesCost)} em peças
                    </span>
                  </div>

                  {/* KPI 3: Custo Efetivo Médio */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                      Custo Médio / Un
                    </span>
                    <div className="text-xl font-black text-slate-800 mt-1">
                      {formatBRL(averageUnitEffectiveCost)}
                    </div>
                    <span className="text-[10px] text-slate-500">
                      Base {formatBRL(baseCostPerExpectedItem)} + {formatBRL(partsSharePerNotebook)}{' '}
                      peças
                    </span>
                  </div>

                  {/* KPI 4: Preço Estimado Total */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                      Estimativa Venda
                    </span>
                    <div className="text-xl font-black text-slate-900 mt-1">
                      {formatBRL(financialTotals.totalTargetSales)}
                    </div>
                    <span className="text-[11px] text-slate-500">Soma dos preços de tabela</span>
                  </div>

                  {/* KPI 5: Lucro Estimado */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                      Lucro Estimado
                    </span>
                    <div
                      className={`text-xl font-black mt-1 ${
                        financialTotals.estimatedProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {formatBRL(financialTotals.estimatedProfit)}
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold border-none px-1.5 py-0 ${
                        financialTotals.marginPct >= 0
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {financialTotals.marginPct.toFixed(1)}% Margem
                    </Badge>
                  </div>

                  {/* KPI 6: Potencial Disponíveis */}
                  <div className="bg-white p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-xs">
                    <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider block">
                      Potencial Disponível
                    </span>
                    <div className="text-xl font-black text-emerald-700 mt-1">
                      {formatBRL(financialTotals.potentialAvailableSales)}
                    </div>
                    <span className="text-[10px] text-emerald-700 font-medium">
                      {statusCounts.disponivel} un pronta(s) p/ venda
                    </span>
                  </div>
                </div>

                {/* STATUS BREAKDOWN BADGES BAR */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  <div className="text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
                    <span>Distribuição de Status do Inventário</span>
                    <span className="text-slate-500 font-normal">
                      {inventoriedCount} equipamentos cadastrados
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                      <span className="font-semibold text-emerald-800">Disponível</span>
                      <span className="font-bold text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded-full text-xs">
                        {statusCounts.disponivel}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-between">
                      <span className="font-semibold text-blue-800">Reservado</span>
                      <span className="font-bold text-blue-900 bg-blue-100 px-2 py-0.5 rounded-full text-xs">
                        {statusCounts.reservado}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-between">
                      <span className="font-semibold text-amber-800">Pendente de ativação</span>
                      <span className="font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full text-xs">
                        {statusCounts.pendente}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-between">
                      <span className="font-semibold text-slate-700">Vendido</span>
                      <span className="font-bold text-slate-900 bg-slate-200 px-2 py-0.5 rounded-full text-xs">
                        {statusCounts.vendido}
                      </span>
                    </div>
                  </div>
                </div>

                {/* MINI GRÁFICOS LADO A LADO NA ABA DE VISÃO GERAL */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Status Rosca */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                    <h3 className="text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                      <PieChartIcon className="w-4 h-4 text-orange-600" />
                      Status dos Equipamentos
                    </h3>
                    <div className="h-56">
                      {statusPieData.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-xs text-slate-400">
                          Nenhum equipamento inventariado
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={statusPieData}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              innerRadius={48}
                              outerRadius={75}
                              paddingAngle={3}
                            >
                              {statusPieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(val: any) => [`${val} equipamento(s)`, 'Quantidade']}
                            />
                            <Legend
                              verticalAlign="bottom"
                              height={36}
                              formatter={(value) => (
                                <span className="text-xs text-slate-700">{value}</span>
                              )}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  {/* Custo Consolidado: Aquisição vs Peças */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                    <h3 className="text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                      <Wrench className="w-4 h-4 text-amber-600" />
                      Composição do Custo (Equipamentos vs Peças)
                    </h3>
                    <div className="h-56">
                      {costBreakdownData.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-xs text-slate-400">
                          Custos não lançados
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={costBreakdownData}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              innerRadius={48}
                              outerRadius={75}
                              paddingAngle={3}
                            >
                              {costBreakdownData.map((entry, index) => (
                                <Cell key={`cell-cost-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(val: any) => [formatBRL(Number(val)), 'Valor']} />
                            <Legend
                              verticalAlign="bottom"
                              height={36}
                              formatter={(value) => (
                                <span className="text-xs text-slate-700">{value}</span>
                              )}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: GRÁFICOS ANALÍTICOS COMPLETOS */}
            {activeTab === 'charts' && (
              <div className="space-y-5">
                {/* Gráfico 1: Receita Estimada vs Custo Consolidado por Grupo */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-[#d9532f]" />
                        Receita vs Custo Efetivo por Modelo (Top Modelos)
                      </h3>
                      <p className="text-xs text-slate-500">
                        Comparativo consolidado por grupo homogêneo de equipamentos
                      </p>
                    </div>
                  </div>
                  <div className="h-72 mt-2">
                    {modelRevenueVsCostData.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-xs text-slate-400">
                        Sem dados suficientes para gerar comparativo de modelos.
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={modelRevenueVsCostData}
                          margin={{ top: 10, right: 15, left: 10, bottom: 25 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            interval={0}
                            angle={-15}
                            textAnchor="end"
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            tickFormatter={(v) =>
                              `R$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`
                            }
                          />
                          <Tooltip
                            formatter={(value: any, name: any) => [
                              formatBRL(Number(value)),
                              name === 'Receita'
                                ? 'Receita Estimada'
                                : name === 'Custo'
                                  ? 'Custo Efetivo'
                                  : 'Lucro Líquido',
                            ]}
                          />
                          <Legend verticalAlign="top" height={36} />
                          <Bar dataKey="Receita" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Custo" fill="#f97316" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Lucro" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Gráfico 2: Margem % por Modelo */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-600" />
                        Margem % Estimada por Grupo de Modelo
                      </h3>
                      <p className="text-xs text-slate-500">
                        Verde: &gt;= 25% | Âmbar: 10% a 24% | Vermelho: &lt; 10%
                      </p>
                    </div>
                  </div>
                  <div className="h-64 mt-2">
                    {modelMarginData.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-xs text-slate-400">
                        Nenhum modelo cadastrado
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={modelMarginData}
                          margin={{ top: 10, right: 15, left: 10, bottom: 25 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            interval={0}
                            angle={-15}
                            textAnchor="end"
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            tickFormatter={(v) => `${v}%`}
                          />
                          <Tooltip
                            formatter={(value: any) => [
                              `${Number(value).toFixed(1)}%`,
                              'Margem Estimada',
                            ]}
                          />
                          <Bar dataKey="margem" radius={[4, 4, 0, 0]}>
                            {modelMarginData.map((entry, index) => (
                              <Cell key={`cell-margin-${index}`} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: TABELA DE MODELOS AGRUPADOS */}
            {activeTab === 'models' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Agrupamento de Modelos & Configurações ({groupedModels.length})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Visão condensada de modelos idênticos com rateio unitário de peças em cada
                      notebook.
                    </p>
                  </div>
                </div>

                {groupedModels.length === 0 ? (
                  <div className="py-10 text-center bg-white rounded-xl border border-slate-200 text-xs text-slate-400">
                    Nenhum modelo inventariado neste lote.
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold">
                            <th className="py-2.5 px-3">Modelo / Configuração</th>
                            <th className="py-2.5 px-3 text-center">Qtd</th>
                            <th className="py-2.5 px-3">Custo Efetivo Médio</th>
                            <th className="py-2.5 px-3">Preço Médio Estimado</th>
                            <th className="py-2.5 px-3">Lucro Médio</th>
                            <th className="py-2.5 px-3">Margem %</th>
                            <th className="py-2.5 px-3">Status Breakdown</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {groupedModels.map((g) => (
                            <tr key={g.modelKey} className="hover:bg-slate-50/70">
                              <td className="py-2.5 px-3">
                                <div className="font-bold text-slate-900">{g.name}</div>
                                <div className="text-[11px] text-slate-500">{g.specs}</div>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-xs">
                                  {g.count}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-slate-800">
                                {formatBRL(g.avgEffectiveCost)}
                              </td>
                              <td className="py-2.5 px-3 font-bold text-slate-900">
                                {formatBRL(g.avgUnitPrice)}
                              </td>
                              <td
                                className={`py-2.5 px-3 font-bold ${
                                  g.avgEstimatedProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'
                                }`}
                              >
                                {formatBRL(g.avgEstimatedProfit)}
                              </td>
                              <td className="py-2.5 px-3">
                                <Badge
                                  variant="outline"
                                  className={`text-[11px] font-bold border-none ${
                                    g.avgMarginPct >= 25
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : g.avgMarginPct >= 10
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-rose-100 text-rose-800'
                                  }`}
                                >
                                  {g.avgMarginPct.toFixed(1)}%
                                </Badge>
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                                  {g.availableCount > 0 && (
                                    <span className="text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">
                                      {g.availableCount} disp.
                                    </span>
                                  )}
                                  {g.reservedCount > 0 && (
                                    <span className="text-blue-700 font-semibold bg-blue-50 px-1.5 py-0.5 rounded">
                                      {g.reservedCount} res.
                                    </span>
                                  )}
                                  {g.pendingCount > 0 && (
                                    <span className="text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.5 rounded">
                                      {g.pendingCount} pend.
                                    </span>
                                  )}
                                  {g.soldCount > 0 && (
                                    <span className="text-slate-600 font-semibold bg-slate-100 px-1.5 py-0.5 rounded">
                                      {g.soldCount} vend.
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: PEÇAS & RATEIO */}
            {activeTab === 'parts' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Peças e Insumos do Lote ({parts.length})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Custo total de peças rateado igualmente por todos os {divisorEquipamentos}{' '}
                      equipamentos do lote.
                    </p>
                  </div>
                  <Badge className="bg-amber-100 text-amber-900 border-none font-bold text-xs">
                    Parcela: +{formatBRL(partsSharePerNotebook)}/equipamento
                  </Badge>
                </div>

                {parts.length === 0 ? (
                  <div className="py-10 text-center bg-white rounded-xl border border-slate-200 text-xs text-slate-400">
                    Nenhuma peça ou serviço adicional vinculado a este lote.
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold">
                            <th className="py-2.5 px-3">Peça / Insumo</th>
                            <th className="py-2.5 px-3 text-center">Quantidade</th>
                            <th className="py-2.5 px-3">Custo Unitário</th>
                            <th className="py-2.5 px-3">Custo Total</th>
                            <th className="py-2.5 px-3">Status do Fluxo</th>
                            <th className="py-2.5 px-3">Parcela por Equipamento</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {parts.map((p) => {
                            const qty = Math.max(1, Number(p.quantity) || 1)
                            const unitCost = Number(p.cost) || 0
                            const totalLine = unitCost * qty
                            const lineSharePerEquip =
                              divisorEquipamentos > 0 ? totalLine / divisorEquipamentos : 0

                            return (
                              <tr key={p.id} className="hover:bg-slate-50/70">
                                <td className="py-2.5 px-3">
                                  <span className="font-bold text-slate-900">{p.name}</span>
                                  {p.supplier && (
                                    <span className="text-[11px] text-slate-400 block">
                                      Fornecedor: {p.supplier}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                                  {qty}
                                </td>
                                <td className="py-2.5 px-3 text-slate-600">
                                  {formatBRL(unitCost)}
                                </td>
                                <td className="py-2.5 px-3 font-bold text-slate-900">
                                  {formatBRL(totalLine)}
                                </td>
                                <td className="py-2.5 px-3">
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] font-semibold ${
                                      p.status === 'Instalada'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : p.status === 'Recebida'
                                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                                          : p.status === 'Comprada'
                                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                                            : 'bg-slate-100 text-slate-700 border-slate-200'
                                    }`}
                                  >
                                    {p.status || 'Comprada'}
                                  </Badge>
                                </td>
                                <td className="py-2.5 px-3 font-medium text-amber-800">
                                  +{formatBRL(lineSharePerEquip)}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot className="border-t border-slate-200 bg-slate-50/90 font-semibold text-slate-900">
                          <tr>
                            <td className="py-2.5 px-3">Total Consolidado de Peças</td>
                            <td className="py-2.5 px-3 text-center">{totalPartsQuantity}</td>
                            <td className="py-2.5 px-3">-</td>
                            <td className="py-2.5 px-3 text-amber-700 font-bold">
                              {formatBRL(partsAndServicesCost)}
                            </td>
                            <td className="py-2.5 px-3">-</td>
                            <td className="py-2.5 px-3 text-amber-800 font-bold">
                              +{formatBRL(partsSharePerNotebook)} / un
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* FOOTER DO MODAL */}
          <DialogFooter className="p-3.5 bg-white border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shrink-0">
            <div className="text-xs text-slate-500">
              {products.length} equipamento(s) no lote • {groupedModels.length} modelo(s)
              agrupado(s) • Rateio de R$ {partsSharePerNotebook.toFixed(2)}/un
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-xs h-9 border-slate-300 text-slate-700"
              >
                Fechar
              </Button>
              <Button
                type="button"
                onClick={handlePrint}
                className="bg-[#d9532f] hover:bg-[#c24624] text-white text-xs h-9 font-semibold gap-1.5 shadow-xs"
              >
                <Printer className="w-4 h-4" />
                Imprimir Relatório (A4)
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PORTAL DE IMPRESSÃO A4 DEDICADO (@media print) */}
      {open &&
        batch &&
        typeof document !== 'undefined' &&
        createPortal(
          <div id="printable-batch-report-root" className="printable-root-hidden">
            <div className="printable-batch-report-sheet">
              {/* CABEÇALHO DO DOCUMENTO IMPRESSO */}
              <div className="border-b-2 border-slate-900 pb-3 mb-4 flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-black text-slate-900 tracking-tight">
                    RELATÓRIO EXECUTIVO DE LOTE DE ENTRADA
                  </h1>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Sistema AmbicorpFlow · Gestão de Lotes & Lucratividade Consolidada
                  </p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <div>
                    Gerado em: <strong>{generatedAt.toLocaleString('pt-BR')}</strong>
                  </div>
                  {tenantName && (
                    <div>
                      Tenant: <strong>{tenantName}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* IDENTIFICAÇÃO DO LOTE */}
              <div className="bg-slate-50 border border-slate-300 rounded p-3 mb-4 grid grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">
                    Fornecedor
                  </span>
                  <strong className="text-slate-900 text-sm">{batch.supplier}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">
                    Nota Fiscal / NFe
                  </span>
                  <strong className="text-slate-900 text-sm">
                    {batch.invoice_number ? `NF ${batch.invoice_number}` : 'N/A'}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">
                    Data de Compra
                  </span>
                  <span className="text-slate-800">
                    {batch.purchase_date
                      ? new Date(batch.purchase_date).toLocaleDateString('pt-BR')
                      : new Date(batch.created).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">
                    Status do Lote
                  </span>
                  <span className="font-semibold text-slate-900 capitalize">
                    {batch.status === 'concluido' ? 'Concluído' : 'Em processamento'}
                  </span>
                </div>
              </div>

              {/* TABELA DE KPIS CONSOLIDADOS */}
              <div className="grid grid-cols-6 gap-2 mb-4 text-center">
                <div className="border border-slate-300 p-2 rounded bg-white">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Equipamentos</div>
                  <div className="text-base font-extrabold text-slate-900">
                    {inventoriedCount}{' '}
                    <span className="text-[10px] font-normal text-slate-400">/ {expectedQty}</span>
                  </div>
                </div>
                <div className="border border-slate-300 p-2 rounded bg-white">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">
                    Custo Consolidado
                  </div>
                  <div className="text-base font-extrabold text-slate-900">
                    {formatBRL(totalConsolidatedCost)}
                  </div>
                  <div className="text-[9px] text-slate-500">
                    {formatBRL(partsAndServicesCost)} peças
                  </div>
                </div>
                <div className="border border-slate-300 p-2 rounded bg-white">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">
                    Custo Efetivo / Un
                  </div>
                  <div className="text-base font-extrabold text-slate-900">
                    {formatBRL(averageUnitEffectiveCost)}
                  </div>
                  <div className="text-[9px] text-slate-500">
                    +{formatBRL(partsSharePerNotebook)} peças
                  </div>
                </div>
                <div className="border border-slate-300 p-2 rounded bg-white">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">
                    Estimativa Venda
                  </div>
                  <div className="text-base font-extrabold text-slate-900">
                    {formatBRL(financialTotals.totalTargetSales)}
                  </div>
                </div>
                <div className="border border-slate-300 p-2 rounded bg-white">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">
                    Lucro Estimado
                  </div>
                  <div
                    className={`text-base font-extrabold ${
                      financialTotals.estimatedProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {formatBRL(financialTotals.estimatedProfit)}
                  </div>
                  <div className="text-[9px] font-bold text-slate-700">
                    {financialTotals.marginPct.toFixed(1)}% Margem
                  </div>
                </div>
                <div className="border border-slate-300 p-2 rounded bg-white">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Disponíveis</div>
                  <div className="text-base font-extrabold text-emerald-800">
                    {statusCounts.disponivel} un
                  </div>
                  <div className="text-[9px] text-emerald-700 font-semibold">
                    {formatBRL(financialTotals.potentialAvailableSales)}
                  </div>
                </div>
              </div>

              {/* SEÇÃO DE GRÁFICOS (RENDERIZADOS COMO SVG NO PRINT) */}
              <div className="grid grid-cols-2 gap-3 mb-4 break-inside-avoid">
                <div className="border border-slate-300 rounded p-2.5 bg-white">
                  <div className="text-[11px] font-bold text-slate-800 mb-1">
                    Distribuição de Status dos Equipamentos
                  </div>
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusPieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={36}
                          outerRadius={58}
                          paddingAngle={3}
                          isAnimationActive={false}
                        >
                          {statusPieData.map((entry, index) => (
                            <Cell key={`print-pie-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Legend
                          verticalAlign="bottom"
                          height={28}
                          formatter={(value) => (
                            <span className="text-[10px] text-slate-800 font-semibold">
                              {value}
                            </span>
                          )}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="border border-slate-300 rounded p-2.5 bg-white">
                  <div className="text-[11px] font-bold text-slate-800 mb-1">
                    Receita vs Custo Efetivo por Modelo (R$)
                  </div>
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={modelRevenueVsCostData}
                        margin={{ top: 5, right: 10, left: -10, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="2 2" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 9, fill: '#000' }}
                          interval={0}
                          angle={-15}
                          textAnchor="end"
                        />
                        <YAxis tick={{ fontSize: 9, fill: '#000' }} />
                        <Legend
                          verticalAlign="top"
                          height={24}
                          formatter={(value) => (
                            <span className="text-[10px] text-slate-800 font-semibold">
                              {value}
                            </span>
                          )}
                        />
                        <Bar dataKey="Receita" fill="#3b82f6" isAnimationActive={false} />
                        <Bar dataKey="Custo" fill="#f97316" isAnimationActive={false} />
                        <Bar dataKey="Lucro" fill="#10b981" isAnimationActive={false} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* TABELA DE MODELOS AGRUPADOS (PRINT) */}
              <div className="mb-4 break-inside-avoid">
                <div className="text-xs font-bold text-slate-900 mb-1.5 flex items-center justify-between">
                  <span>
                    Equipamentos Agrupados por Modelo & Configuração ({groupedModels.length})
                  </span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    Total: {products.length} notebooks
                  </span>
                </div>
                <table className="w-full text-left border-collapse text-[10px] border border-slate-300">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-800 uppercase">
                      <th className="py-1.5 px-2 border-r border-slate-200">
                        Modelo / Configuração
                      </th>
                      <th className="py-1.5 px-2 text-center border-r border-slate-200">Qtd</th>
                      <th className="py-1.5 px-2 border-r border-slate-200">Custo Efetivo Méd.</th>
                      <th className="py-1.5 px-2 border-r border-slate-200">Preço Méd. Estim.</th>
                      <th className="py-1.5 px-2 border-r border-slate-200">Lucro Médio</th>
                      <th className="py-1.5 px-2 border-r border-slate-200">Margem %</th>
                      <th className="py-1.5 px-2">Status Breakdown</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {groupedModels.map((g) => (
                      <tr key={`print-group-${g.modelKey}`} className="border-b border-slate-200">
                        <td className="py-1 px-2 border-r border-slate-200">
                          <strong className="text-slate-900">{g.name}</strong>
                          <div className="text-[9px] text-slate-500">{g.specs}</div>
                        </td>
                        <td className="py-1 px-2 text-center font-bold border-r border-slate-200">
                          {g.count}
                        </td>
                        <td className="py-1 px-2 border-r border-slate-200">
                          {formatBRL(g.avgEffectiveCost)}
                        </td>
                        <td className="py-1 px-2 font-bold border-r border-slate-200">
                          {formatBRL(g.avgUnitPrice)}
                        </td>
                        <td className="py-1 px-2 font-bold border-r border-slate-200">
                          {formatBRL(g.avgEstimatedProfit)}
                        </td>
                        <td className="py-1 px-2 font-bold border-r border-slate-200">
                          {g.avgMarginPct.toFixed(1)}%
                        </td>
                        <td className="py-1 px-2 text-[9px]">
                          {g.availableCount} disp. | {g.reservedCount} res. | {g.pendingCount} pend.
                          | {g.soldCount} vend.
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* TABELA DE PEÇAS E RATEIO (PRINT) */}
              {parts.length > 0 && (
                <div className="mb-4 break-inside-avoid">
                  <div className="text-xs font-bold text-slate-900 mb-1.5 flex items-center justify-between">
                    <span>Peças e Reposições Vinculadas ao Lote ({parts.length})</span>
                    <span className="text-[10px] text-slate-700 font-semibold">
                      Total Peças: {formatBRL(partsAndServicesCost)} (+
                      {formatBRL(partsSharePerNotebook)}/un)
                    </span>
                  </div>
                  <table className="w-full text-left border-collapse text-[10px] border border-slate-300">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-800 uppercase">
                        <th className="py-1.5 px-2 border-r border-slate-200">Peça / Insumo</th>
                        <th className="py-1.5 px-2 text-center border-r border-slate-200">Qtd</th>
                        <th className="py-1.5 px-2 border-r border-slate-200">Custo Unitário</th>
                        <th className="py-1.5 px-2 border-r border-slate-200">Custo Total</th>
                        <th className="py-1.5 px-2 border-r border-slate-200">Status Compra</th>
                        <th className="py-1.5 px-2">Parcela / Notebook</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {parts.map((p) => {
                        const qty = Math.max(1, Number(p.quantity) || 1)
                        const unitCost = Number(p.cost) || 0
                        const totalLine = unitCost * qty
                        const lineShare =
                          divisorEquipamentos > 0 ? totalLine / divisorEquipamentos : 0

                        return (
                          <tr key={`print-part-${p.id}`} className="border-b border-slate-200">
                            <td className="py-1 px-2 border-r border-slate-200">
                              <strong>{p.name}</strong>
                              {p.supplier && (
                                <span className="text-[9px] text-slate-500"> ({p.supplier})</span>
                              )}
                            </td>
                            <td className="py-1 px-2 text-center border-r border-slate-200">
                              {qty}
                            </td>
                            <td className="py-1 px-2 border-r border-slate-200">
                              {formatBRL(unitCost)}
                            </td>
                            <td className="py-1 px-2 font-bold border-r border-slate-200">
                              {formatBRL(totalLine)}
                            </td>
                            <td className="py-1 px-2 border-r border-slate-200">
                              {p.status || 'Comprada'}
                            </td>
                            <td className="py-1 px-2 font-semibold">+{formatBRL(lineShare)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* RODAPÉ DO DOCUMENTO IMPRESSO */}
              <div className="pt-3 border-t border-slate-300 flex items-center justify-between text-[10px] text-slate-500 mt-auto">
                <span>AmbicorpFlow · Relatório de Lotes e Controle Financeiro</span>
                <span>
                  Documento emitido eletronicamente para fins de controle e auditoria interna
                </span>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
