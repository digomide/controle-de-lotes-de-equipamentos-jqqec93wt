import React, { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp,
  DollarSign,
  Boxes,
  Layers,
  ArrowUpRight,
  Search,
  ExternalLink,
  Loader2,
  Calendar,
  AlertTriangle,
  FileSpreadsheet,
  PieChart,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { purchaseBatchesService } from '@/services/purchaseBatches'
import { productsService } from '@/services/products'
import { equipmentService } from '@/services/equipment'
import { salesService } from '@/services/sales'
import type { PurchaseBatch, Product, EquipmentPart, Sale, SaleItem } from '@/types/inventory'

interface BatchProfitReportItem {
  batch: PurchaseBatch
  expectedQty: number
  inventoriedCount: number
  triagemProgressPct: number
  acquisitionCost: number
  partsCost: number
  totalCost: number
  realizedRevenue: number
  potentialRevenue: number
  totalProjectedRevenue: number
  realizedProfit: number
  projectedProfit: number
  realizedMarginPct: number
  projectedMarginPct: number
  soldUnitsCount: number
  availableUnitsCount: number
}

export default function LucratividadeLotes() {
  const [loading, setLoading] = useState(true)
  const [reportItems, setReportItems] = useState<BatchProfitReportItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'recent' | 'profit-desc' | 'cost-desc' | 'margin-desc'>(
    'recent',
  )

  const loadReportData = async () => {
    setLoading(true)
    try {
      // 1. Fetch real database entities in parallel
      const [batches, allProducts, allParts, allSales] = await Promise.all([
        purchaseBatchesService.getAll(),
        productsService.getAll(),
        equipmentService.getAllParts(),
        salesService.getAll(),
      ])

      // 2. Fetch all sale items to determine exact sold prices and link to batches
      // We gather sale items for all completed/relevant sales
      const saleItemsPromises = allSales.map((s) => salesService.getSaleItems(s.id))
      const saleItemsResults = await Promise.all(saleItemsPromises)
      const allSaleItems = saleItemsResults.flat()

      // 3. Map products by id and link by purchase_batch_id
      const productsByBatch = new Map<string, Product[]>()
      const productToBatchMap = new Map<string, string>()

      for (const prod of allProducts) {
        if (prod.purchase_batch_id) {
          productToBatchMap.set(prod.id, prod.purchase_batch_id)
          const current = productsByBatch.get(prod.purchase_batch_id) || []
          current.push(prod)
          productsByBatch.set(prod.purchase_batch_id, current)
        }
      }

      // Map parts by purchase_batch_id or product_id
      const partsByBatch = new Map<string, EquipmentPart[]>()
      for (const part of allParts) {
        let bId = part.purchase_batch_id
        if (!bId && part.product_id) {
          bId = productToBatchMap.get(part.product_id)
        }
        if (bId) {
          const current = partsByBatch.get(bId) || []
          current.push(part)
          partsByBatch.set(bId, current)
        }
      }

      // Map sale items realized revenue by product and batch
      // A sale item has product_id. If that product belongs to a purchase_batch, its subtotal is realized revenue for that batch.
      const realizedRevenueByBatch = new Map<string, { total: number; soldCount: number }>()
      for (const item of allSaleItems) {
        if (item.product_id) {
          const bId = productToBatchMap.get(item.product_id)
          if (bId) {
            const current = realizedRevenueByBatch.get(bId) || { total: 0, soldCount: 0 }
            current.total +=
              Number(item.subtotal) || Number(item.unit_price) * Number(item.quantity) || 0
            current.soldCount += Number(item.quantity) || 1
            realizedRevenueByBatch.set(bId, current)
          }
        }
      }

      // 4. Build report items per purchase_batch
      const builtItems: BatchProfitReportItem[] = batches.map((batch) => {
        const expectedQty = Number(batch.expected_quantity) || 1
        const batchProducts = productsByBatch.get(batch.id) || []
        const inventoriedCount = batchProducts.length
        const triagemProgressPct = Math.min(100, Math.round((inventoriedCount / expectedQty) * 100))

        const batchParts = partsByBatch.get(batch.id) || []
        const acquisitionCost = Number(batch.total_cost) || 0
        const partsCost = batchParts.reduce((sum, p) => sum + (Number(p.cost) || 0), 0)
        const totalCost = acquisitionCost + partsCost

        // Realized revenue from sales
        const salesData = realizedRevenueByBatch.get(batch.id) || { total: 0, soldCount: 0 }
        let realizedRevenue = salesData.total
        let soldUnitsCount = salesData.soldCount

        // If a product is marked as 'Vendido' but didn't have a sale_item record yet, take its unit_price
        for (const p of batchProducts) {
          if (p.status === 'Vendido') {
            const alreadyTrackedInSale = allSaleItems.some((si) => si.product_id === p.id)
            if (!alreadyTrackedInSale) {
              realizedRevenue += Number(p.unit_price) || 0
              soldUnitsCount += 1
            }
          }
        }

        // Potential revenue from available / reserved products
        let potentialRevenue = 0
        let availableUnitsCount = 0
        for (const p of batchProducts) {
          if (p.status !== 'Vendido') {
            potentialRevenue += Number(p.unit_price) || 0
            availableUnitsCount += 1
          }
        }

        const totalProjectedRevenue = realizedRevenue + potentialRevenue
        const realizedProfit = realizedRevenue - totalCost
        const projectedProfit = totalProjectedRevenue - totalCost

        const realizedMarginPct =
          totalCost > 0 ? (realizedProfit / totalCost) * 100 : realizedRevenue > 0 ? 100 : 0
        const projectedMarginPct =
          totalCost > 0 ? (projectedProfit / totalCost) * 100 : totalProjectedRevenue > 0 ? 100 : 0

        return {
          batch,
          expectedQty,
          inventoriedCount,
          triagemProgressPct,
          acquisitionCost,
          partsCost,
          totalCost,
          realizedRevenue,
          potentialRevenue,
          totalProjectedRevenue,
          realizedProfit,
          projectedProfit,
          realizedMarginPct,
          projectedMarginPct,
          soldUnitsCount,
          availableUnitsCount,
        }
      })

      setReportItems(builtItems)
    } catch (err) {
      console.error('Erro ao carregar dados do relatório de lucratividade:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReportData()
  }, [])

  // Filter & Sort
  const filteredItems = useMemo(() => {
    let list = reportItems.filter((item) => {
      if (statusFilter !== 'all' && item.batch.status !== statusFilter) {
        return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const supplier = (item.batch.supplier || '').toLowerCase()
        const nf = (item.batch.invoice_number || '').toLowerCase()
        const notes = (item.batch.notes || '').toLowerCase()
        return supplier.includes(q) || nf.includes(q) || notes.includes(q)
      }
      return true
    })

    if (sortBy === 'recent') {
      list.sort((a, b) => new Date(b.batch.created).getTime() - new Date(a.batch.created).getTime())
    } else if (sortBy === 'profit-desc') {
      list.sort((a, b) => b.projectedProfit - a.projectedProfit)
    } else if (sortBy === 'cost-desc') {
      list.sort((a, b) => b.totalCost - a.totalCost)
    } else if (sortBy === 'margin-desc') {
      list.sort((a, b) => b.projectedMarginPct - a.projectedMarginPct)
    }

    return list
  }, [reportItems, searchQuery, statusFilter, sortBy])

  // Consolidated Top KPIs
  const consolidated = useMemo(() => {
    const totalBatches = reportItems.length
    const totalInvestment = reportItems.reduce((acc, i) => acc + i.totalCost, 0)
    const totalRealizedRevenue = reportItems.reduce((acc, i) => acc + i.realizedRevenue, 0)
    const totalPotentialRevenue = reportItems.reduce((acc, i) => acc + i.potentialRevenue, 0)
    const totalProjectedRevenue = totalRealizedRevenue + totalPotentialRevenue
    const totalRealizedProfit = totalRealizedRevenue - totalInvestment
    const totalProjectedProfit = totalProjectedRevenue - totalInvestment
    const averageMarginPct =
      totalInvestment > 0 ? (totalProjectedProfit / totalInvestment) * 100 : 0

    return {
      totalBatches,
      totalInvestment,
      totalRealizedRevenue,
      totalPotentialRevenue,
      totalRealizedProfit,
      totalProjectedProfit,
      averageMarginPct,
    }
  }, [reportItems])

  const formatBRL = (val: number) =>
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  if (loading) {
    return (
      <div className="py-24 text-center max-w-7xl mx-auto">
        <Loader2 className="w-9 h-9 animate-spin text-orange-600 mx-auto" />
        <p className="mt-3 text-sm text-slate-500">
          Calculando indicadores de lucratividade por lote...
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Link to="/lotes-entrada" className="hover:text-orange-600 font-medium">
              Lotes de Entrada
            </Link>
            <span>/</span>
            <span className="text-slate-700">Relatório de Lucratividade</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Relatório de Lucratividade por Lote
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Análise financeira em tempo real: aquisição + peças trocadas, receita realizada vs.
            potencial e margens líquidas por lote.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/lotes-entrada">
            <Button variant="outline" className="text-xs h-10 border-slate-300">
              <Boxes className="w-4 h-4 mr-1.5 text-slate-500" />
              Ver Lotes de Entrada
            </Button>
          </Link>
        </div>
      </div>

      {/* Top Consolidate KPIs Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Investimento Total */}
        <Card className="border-slate-200 shadow-xs bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Investimento Total
              </span>
              <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold text-slate-900">
                {formatBRL(consolidated.totalInvestment)}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Aquisição + peças em {consolidated.totalBatches} lote(s)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* KPI 2: Receita Realizada */}
        <Card className="border-slate-200 shadow-xs bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Receita Realizada
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold text-emerald-700">
                {formatBRL(consolidated.totalRealizedRevenue)}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Potencial restante: {formatBRL(consolidated.totalPotentialRevenue)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* KPI 3: Lucro Realizado / Projetado */}
        <Card className="border-slate-200 shadow-xs bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Lucro Projetado
              </span>
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  consolidated.totalProjectedProfit >= 0
                    ? 'bg-blue-50 text-blue-600'
                    : 'bg-rose-50 text-rose-600'
                }`}
              >
                <PieChart className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <div
                className={`text-2xl font-bold ${
                  consolidated.totalProjectedProfit >= 0 ? 'text-blue-700' : 'text-rose-600'
                }`}
              >
                {formatBRL(consolidated.totalProjectedProfit)}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Realizado até agora: {formatBRL(consolidated.totalRealizedProfit)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* KPI 4: Margem Média Projetada */}
        <Card className="border-slate-200 shadow-xs bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Margem Média
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold text-slate-900">
                {consolidated.averageMarginPct.toFixed(1)}%
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Retorno estimado sobre o capital investido
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Search Toolbar */}
      <Card className="border-slate-200 shadow-xs bg-white">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <Input
                placeholder="Buscar por fornecedor, nota fiscal..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-slate-50 border-slate-200 text-sm"
              />
            </div>

            <div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-slate-50 border-slate-200 text-sm">
                  <SelectValue placeholder="Status do Lote" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="em_processamento">Em processamento</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
                <SelectTrigger className="bg-slate-50 border-slate-200 text-sm">
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Mais Recentes</SelectItem>
                  <SelectItem value="profit-desc">Maior Lucro Projetado</SelectItem>
                  <SelectItem value="margin-desc">Maior Margem %</SelectItem>
                  <SelectItem value="cost-desc">Maior Custo Total</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Batches Profitability Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-orange-600" />
            Lucratividade por Lote de Entrada ({filteredItems.length})
          </h2>
          <span className="text-xs text-slate-400">
            Atualizado automaticamente com base nas vendas e peças
          </span>
        </div>

        {filteredItems.length === 0 ? (
          <Card className="border-dashed border-2 border-slate-200 bg-white">
            <CardContent className="py-12 text-center">
              <Boxes className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="font-semibold text-slate-700">Nenhum lote encontrado</h3>
              <p className="text-xs text-slate-400 mt-1">
                Tente ajustar os filtros de busca para visualizar os lotes cadastrados.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Lote / Fornecedor</th>
                    <th className="py-3 px-4">Triagem</th>
                    <th className="py-3 px-4">Custo Total</th>
                    <th className="py-3 px-4">Receita Realizada</th>
                    <th className="py-3 px-4">Receita Potencial</th>
                    <th className="py-3 px-4">Lucro Realizado</th>
                    <th className="py-3 px-4">Lucro Projetado</th>
                    <th className="py-3 px-4">Margem %</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map((item) => {
                    const isProfit = item.projectedProfit >= 0
                    const isRealizedProfit = item.realizedProfit >= 0

                    return (
                      <tr key={item.batch.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Lote e Identificador */}
                        <td className="py-3.5 px-4">
                          <Link
                            to={`/lotes-entrada/${item.batch.id}`}
                            className="font-semibold text-slate-900 hover:text-orange-600 transition-colors flex items-center gap-1.5"
                          >
                            {item.batch.supplier}
                            <ExternalLink className="w-3 h-3 text-slate-400" />
                          </Link>
                          <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                            {item.batch.invoice_number && (
                              <span className="font-mono bg-slate-100 px-1.5 py-0.2 rounded text-[11px]">
                                NF {item.batch.invoice_number}
                              </span>
                            )}
                            <span className="text-[11px] text-slate-400">
                              {new Date(item.batch.created).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        </td>

                        {/* Triagem Progress */}
                        <td className="py-3.5 px-4 min-w-[130px]">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-medium text-slate-700">
                              {item.inventoriedCount} / {item.expectedQty} un
                            </span>
                            <span className="font-bold text-orange-600 text-[11px]">
                              {item.triagemProgressPct}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                item.triagemProgressPct >= 100 ? 'bg-emerald-500' : 'bg-orange-500'
                              }`}
                              style={{ width: `${item.triagemProgressPct}%` }}
                            />
                          </div>
                        </td>

                        {/* Custo Total (Aquisição + Peças) */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900 text-xs">
                            {formatBRL(item.totalCost)}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Base: {formatBRL(item.acquisitionCost)}
                            {item.partsCost > 0 && (
                              <span className="text-amber-600 ml-1">
                                + {formatBRL(item.partsCost)} peças
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Receita Realizada */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-emerald-700 text-xs">
                            {formatBRL(item.realizedRevenue)}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {item.soldUnitsCount} un vendida(s)
                          </div>
                        </td>

                        {/* Receita Potencial */}
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-700 text-xs">
                            {formatBRL(item.potentialRevenue)}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {item.availableUnitsCount} un disponível(is)
                          </div>
                        </td>

                        {/* Lucro Realizado */}
                        <td className="py-3.5 px-4">
                          <div
                            className={`font-semibold text-xs ${
                              isRealizedProfit ? 'text-emerald-600' : 'text-slate-500'
                            }`}
                          >
                            {formatBRL(item.realizedProfit)}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Margem: {item.realizedMarginPct.toFixed(1)}%
                          </div>
                        </td>

                        {/* Lucro Projetado */}
                        <td className="py-3.5 px-4">
                          <div
                            className={`font-bold text-xs ${
                              isProfit ? 'text-emerald-700' : 'text-rose-600'
                            }`}
                          >
                            {formatBRL(item.projectedProfit)}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Total: {formatBRL(item.totalProjectedRevenue)}
                          </div>
                        </td>

                        {/* Margem % Projetada */}
                        <td className="py-3.5 px-4">
                          <Badge
                            variant="outline"
                            className={`text-xs font-semibold border-none ${
                              item.projectedMarginPct >= 25
                                ? 'bg-emerald-100 text-emerald-800'
                                : item.projectedMarginPct >= 10
                                  ? 'bg-blue-100 text-blue-800'
                                  : item.projectedMarginPct >= 0
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {item.projectedMarginPct.toFixed(1)}%
                          </Badge>
                        </td>

                        {/* Ação */}
                        <td className="py-3.5 px-4 text-right">
                          <Link to={`/lotes-entrada/${item.batch.id}`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs h-7 px-2.5 text-orange-700 bg-orange-50 hover:bg-orange-100"
                            >
                              Ver Lote
                            </Button>
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
