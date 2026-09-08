import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  DollarSign,
  TrendingUp,
  Flame,
  ShoppingBag,
  Layers,
  BarChart3,
  Percent,
} from 'lucide-react'
import type { CollectorSummaryReport } from '@/services/mlCollectorService'
import type { ExactProductSummary } from '@/services/mlExactProductService'

interface NumerosDoMercadoProps {
  collectorReport: CollectorSummaryReport | null
  catalogSummary: ExactProductSummary | null
}

export function NumerosDoMercado({ collectorReport, catalogSummary }: NumerosDoMercadoProps) {
  // Preferir dados enriquecidos da coleta com vendas auditadas; quando não houver coletor, sintetizar honestamente com catalogSummary
  const hasCollector = Boolean(collectorReport && collectorReport.total_deduplicated_ads > 0)

  // 1. Total de unidades vendidas somadas
  const totalSoldUnits = hasCollector
    ? collectorReport!.total_sold_units || 0
    : catalogSummary?.totalConfirmedSalesAcrossSellers || 0

  // 2. Preço médio ponderado (faturamento / unidades)
  const weightedAvgPrice = hasCollector
    ? collectorReport!.weighted_avg_price || 0
    : catalogSummary?.priceAvg || 0

  // 3. Média simples vs mediana
  const simpleAvgPrice = hasCollector
    ? collectorReport!.simple_avg_price || 0
    : catalogSummary?.priceAvg || 0

  const medianPrice = hasCollector
    ? collectorReport!.median_price || 0
    : catalogSummary?.priceMedian || 0

  // 4. Faixa de preço de quem vende (piso e teto)
  const minPrice = hasCollector ? collectorReport!.min_price || 0 : catalogSummary?.priceMin || 0

  const maxPrice = hasCollector ? collectorReport!.max_price || 0 : catalogSummary?.priceMax || 0

  // 5. Total de anúncios e % com vendas
  const totalAds = hasCollector
    ? collectorReport!.total_deduplicated_ads
    : catalogSummary?.totalActiveAds || 0

  const adsWithSales = hasCollector
    ? collectorReport!.ads_with_sales_count
    : catalogSummary?.hasAnyConfirmedSales
      ? 1
      : 0

  const percentWithSales = totalAds > 0 ? Math.round((adsWithSales / totalAds) * 100) : 0

  return (
    <Card className="border-slate-200 bg-white shadow-xs">
      <CardHeader className="pb-3 border-b border-slate-100">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Badge className="bg-slate-900 text-white font-bold text-xs gap-1.5 px-2.5 py-0.5">
                <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
                3. NÚMEROS DO MERCADO
              </Badge>
              <Badge variant="outline" className="text-[10px] text-slate-600 bg-slate-50">
                Síntese Executiva & Médias de Venda
              </Badge>
            </div>
            <p className="text-xs text-slate-500">
              Visão macro consolidada de faturamento real, dispersão de preços e densidade de
              anúncios com vendas.
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Card 1: Preço Médio PONDERADO (Faturamento / Unidades) */}
          <div className="p-4 bg-gradient-to-br from-emerald-500/15 via-emerald-50/60 to-white rounded-xl border-2 border-emerald-400 shadow-2xs space-y-1 col-span-2 sm:col-span-1">
            <span className="text-[10px] font-bold uppercase text-emerald-800 flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" /> Preço Médio Ponderado
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-950">
                {weightedAvgPrice > 0
                  ? weightedAvgPrice.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })
                  : 'R$ 0,00'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 pt-0.5">
              <Badge className="bg-emerald-600 text-white text-[9px] px-1.5 py-0 h-4 font-bold">
                Ponderado
              </Badge>
              <span className="text-[10px] text-emerald-800 font-semibold leading-tight">
                (Faturamento / Unidades)
              </span>
            </div>
            <p className="text-[10px] text-slate-500 leading-tight pt-1">
              Reflete o ticket médio que o comprador efetivamente paga.
            </p>
          </div>

          {/* Card 2: Total de Unidades Vendidas */}
          <div className="p-4 bg-white rounded-xl border border-amber-200 shadow-2xs space-y-1">
            <span className="text-[10px] font-bold uppercase text-amber-800 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-amber-500" /> Unidades Vendidas
            </span>
            <div className="mt-0.5">
              <span className="text-2xl sm:text-3xl font-black font-mono text-amber-700 block">
                {totalSoldUnits.toLocaleString('pt-BR')} un.
              </span>
            </div>
            <span className="text-[10px] text-slate-500 block">Soma total auditada</span>
            <span className="text-[10px] text-emerald-700 font-bold block">
              {adsWithSales} anúncio(s) com giro
            </span>
          </div>

          {/* Card 3: Média Simples vs Mediana */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-indigo-500" /> Média vs Mediana
            </span>
            <div className="mt-0.5">
              <span className="text-xl sm:text-2xl font-black font-mono text-slate-900 block">
                {simpleAvgPrice > 0
                  ? simpleAvgPrice.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })
                  : 'N/D'}
              </span>
            </div>
            <div className="text-[11px] text-slate-600 font-mono flex items-center gap-1">
              <span>Mediana:</span>
              <strong className="text-slate-900 font-bold">
                {medianPrice > 0
                  ? medianPrice.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })
                  : 'N/D'}
              </strong>
            </div>
            <span className="text-[10px] text-slate-400 block leading-tight">
              Calculada sobre anúncios com vendas
            </span>
          </div>

          {/* Card 4: Faixa de Preço de Quem Vende (Piso e Teto) */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
            <span className="text-[10px] font-bold uppercase text-purple-900 flex items-center gap-1">
              <ShoppingBag className="w-3.5 h-3.5 text-purple-600" /> Faixa de Preço (Quem Vende)
            </span>
            <div className="mt-0.5">
              <span className="text-lg sm:text-xl font-black font-mono text-purple-950 block">
                {minPrice > 0
                  ? minPrice.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })
                  : 'N/D'}
              </span>
            </div>
            <span className="text-[11px] text-slate-600 font-mono block">
              Até{' '}
              {maxPrice > 0
                ? maxPrice.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })
                : 'N/D'}
            </span>
            <span className="text-[10px] text-slate-400 block">Piso e teto de quem gira</span>
          </div>

          {/* Card 5: % de Anúncios com Vendas */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
              <Percent className="w-3.5 h-3.5 text-blue-500" /> % com Vendas
            </span>
            <div className="mt-0.5">
              <span className="text-2xl sm:text-3xl font-black font-mono text-slate-900 block">
                {percentWithSales}%
              </span>
            </div>
            <span className="text-[10px] text-emerald-700 font-bold block">
              {adsWithSales} de {totalAds} anúncios
            </span>
            <span className="text-[10px] text-slate-400 block">
              {Math.max(0, totalAds - adsWithSales)} sem vendas expostas
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
