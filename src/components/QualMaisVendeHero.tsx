import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Trophy,
  Flame,
  Cpu,
  Package,
  Layers,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  Sparkles,
  Zap,
} from 'lucide-react'
import type {
  CollectorSummaryReport,
  CollectorTopSpec,
  CollectorDeduplicatedAd,
} from '@/services/mlCollectorService'

interface QualMaisVendeHeroProps {
  report: CollectorSummaryReport | null
  searchTerm: string
  onOpenCollector?: () => void
}

export function QualMaisVendeHero({ report, searchTerm, onOpenCollector }: QualMaisVendeHeroProps) {
  const [showAllSpecs, setShowAllSpecs] = useState(false)

  // Caso não haja dados ou relatório com especificações
  const hasSpecs = Boolean(report && report.top_specs && report.top_specs.length > 0)
  const championSpec: CollectorTopSpec | null = hasSpecs ? report!.top_specs[0] : null
  const subsequentSpecs: CollectorTopSpec[] = hasSpecs ? report!.top_specs.slice(1) : []
  const displayedSubsequent = showAllSpecs ? subsequentSpecs : subsequentSpecs.slice(0, 4)

  const totalSoldUnits = report?.total_sold_units || 0

  if (!hasSpecs || !championSpec) {
    return (
      <Card className="border-amber-200/80 bg-gradient-to-br from-amber-50/50 via-white to-slate-50 shadow-xs">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Badge className="bg-amber-500 text-slate-950 font-black text-xs gap-1.5 px-2.5 py-0.5">
                  <Flame className="w-3.5 h-3.5 fill-slate-950 text-slate-950" />
                  1. QUAL MAIS VENDE?
                </Badge>
                <span className="text-xs font-bold text-slate-700">&quot;{searchTerm}&quot;</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Ainda sem vendas auditadas para classificar a especificação campeã
              </h3>
              <p className="text-xs text-slate-500 max-w-xl leading-relaxed">
                As coletas gravadas para este termo ainda não possuem números explícitos de unidades
                vendidas por anúncio ou a varredura do Coletor do Navegador ainda não foi executada
                nesta busca.
              </p>
            </div>
            {onOpenCollector && (
              <Button
                size="sm"
                onClick={onOpenCollector}
                className="h-9 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold gap-1.5 shrink-0 shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Coletar Vendas no Navegador
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  const championShare =
    totalSoldUnits > 0 ? Math.round((championSpec.totalUnits / totalSoldUnits) * 100) : 0

  return (
    <Card className="border-2 border-amber-400 bg-gradient-to-br from-amber-50/70 via-white to-orange-50/30 shadow-sm overflow-hidden">
      {/* Header Herói */}
      <CardHeader className="pb-3 border-b border-amber-200 bg-gradient-to-r from-amber-500/20 via-orange-400/10 to-transparent">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs px-3 py-1 gap-1.5 shadow-2xs tracking-wide">
                <Trophy className="w-4 h-4 fill-slate-950 text-slate-950" />
                1. QUAL MAIS VENDE NO MERCADO?
              </Badge>
              <Badge
                variant="outline"
                className="bg-white text-amber-900 border-amber-300 font-mono text-[10px] font-bold"
              >
                Termo: &quot;{report?.term || searchTerm}&quot;
              </Badge>
              <Badge className="bg-emerald-600 text-white text-[10px] font-semibold">
                Auditado via Coletor de Vendas
              </Badge>
            </div>
            <p className="text-xs text-slate-600 pt-0.5">
              Consolidação de demanda real: identifica a especificação/modelo dominante em unidades
              pagas pelos clientes.
            </p>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[10px] font-bold uppercase text-slate-500 block">
              Volume Total Auditado
            </span>
            <span className="text-xl sm:text-2xl font-black font-mono text-emerald-800 block">
              {totalSoldUnits.toLocaleString('pt-BR')} un.
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-6">
        {/* BLOCO CAMPEÃO COM DESTAQUE MÁXIMO */}
        <div className="p-4 sm:p-6 bg-gradient-to-r from-amber-500/20 via-amber-400/10 to-white rounded-2xl border-2 border-amber-400 shadow-xs relative">
          <div className="absolute -top-3.5 left-5">
            <Badge className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs gap-1.5 px-3.5 py-1 shadow-sm">
              <Trophy className="w-4 h-4 fill-slate-950 text-slate-950" />🏆 ESPECIFICAÇÃO CAMPEÃ DE
              VENDAS
            </Badge>
          </div>

          <div className="pt-2 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
            {/* Nome da Espec e Badges */}
            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-mono font-black text-lg shadow-2xs shrink-0">
                  #1
                </div>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight leading-tight">
                    {championSpec.spec}
                  </h2>
                  <p className="text-xs text-slate-600">
                    Especificação que mais converte clientes e concentra a maior fatia de vendas no
                    Mercado Livre.
                  </p>
                </div>
              </div>

              {/* Barra de Share de Vendas */}
              <div className="pt-2 space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span className="flex items-center gap-1.5 text-amber-950">
                    <Zap className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                    Share de Mercado da Campeã:
                  </span>
                  <span className="text-sm font-black font-mono text-emerald-700">
                    {championShare}% de todas as vendas
                  </span>
                </div>
                <div className="w-full bg-amber-200/60 rounded-full h-3 overflow-hidden border border-amber-300">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-emerald-600 rounded-full transition-all duration-700"
                    style={{ width: `${Math.max(8, championShare)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Métricas Principais da Campeã */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full lg:w-auto shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0 border-amber-200">
              {/* Unidades vendidas somadas */}
              <div className="p-3 bg-white/90 rounded-xl border border-amber-200 shadow-2xs text-center sm:text-left">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">
                  Unidades Vendidas
                </span>
                <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-700 block mt-0.5">
                  {championSpec.totalUnits.toLocaleString('pt-BR')}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">unidades somadas</span>
              </div>

              {/* Preço Médio Ponderado */}
              <div className="p-3 bg-white/90 rounded-xl border border-amber-200 shadow-2xs text-center sm:text-left">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">
                  Preço Médio Ponderado
                </span>
                <span className="text-2xl sm:text-3xl font-black font-mono text-slate-950 block mt-0.5">
                  {championSpec.weightedAvgPrice.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </span>
                <span className="text-[10px] text-emerald-700 font-semibold">
                  (Faturamento / Un.)
                </span>
              </div>

              {/* Anúncios Competindo nesta espec */}
              <div className="p-3 bg-white/90 rounded-xl border border-amber-200 shadow-2xs text-center sm:text-left col-span-2 sm:col-span-1">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">
                  Anúncios no Pódio
                </span>
                <span className="text-2xl sm:text-3xl font-black font-mono text-indigo-700 block mt-0.5">
                  {championSpec.adCount}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">anúncios catalogados</span>
              </div>
            </div>
          </div>
        </div>

        {/* SUBSEQUENTES: RANKING 2º AO 5º (OU EXPANSÍVEL) */}
        {subsequentSpecs.length > 0 && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-slate-700" />
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wide">
                  Ranking das Subsequentes (2º ao{' '}
                  {Math.min(subsequentSpecs.length + 1, showAllSpecs ? 10 : 5)}º lugar)
                </h4>
                <Badge
                  variant="outline"
                  className="text-[10px] text-slate-600 bg-slate-50 border-slate-200"
                >
                  {subsequentSpecs.length} especificações complementares
                </Badge>
              </div>

              {subsequentSpecs.length > 4 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllSpecs(!showAllSpecs)}
                  className="h-7 text-xs text-indigo-600 hover:text-indigo-800 font-semibold gap-1 px-2"
                >
                  {showAllSpecs ? 'Ver Menos' : `Ver Todas (${subsequentSpecs.length})`}
                  {showAllSpecs ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </Button>
              )}
            </div>

            {/* Lista/Tabela Compacta com Barras de Representatividade */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white divide-y divide-slate-100">
              {displayedSubsequent.map((specItem, idx) => {
                const rankNumber = idx + 2
                const sharePercent =
                  totalSoldUnits > 0 ? Math.round((specItem.totalUnits / totalSoldUnits) * 100) : 0
                // Proporção relativa à campeã
                const relToChampion =
                  championSpec.totalUnits > 0
                    ? Math.round((specItem.totalUnits / championSpec.totalUnits) * 100)
                    : 0

                return (
                  <div
                    key={specItem.spec || idx}
                    className="p-3 sm:p-3.5 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                  >
                    {/* Rank e Nome */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                          rankNumber === 2
                            ? 'bg-slate-300 text-slate-800'
                            : rankNumber === 3
                              ? 'bg-amber-700 text-white'
                              : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        #{rankNumber}
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h5
                            className="font-bold text-slate-900 text-sm truncate"
                            title={specItem.spec}
                          >
                            {specItem.spec}
                          </h5>
                          <span className="text-[11px] text-slate-400 font-mono">
                            · {specItem.adCount} anúncio(s)
                          </span>
                        </div>

                        {/* Barra de Representatividade */}
                        <div className="flex items-center gap-2 max-w-md">
                          <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-full bg-slate-400 rounded-full"
                              style={{ width: `${Math.max(4, relToChampion)}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono shrink-0">
                            {sharePercent}% do total
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Unidades e Preço Médio Ponderado */}
                    <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0 w-full sm:w-auto border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Vendas
                        </span>
                        <span className="text-sm sm:text-base font-black font-mono text-emerald-700 block">
                          {specItem.totalUnits.toLocaleString('pt-BR')} un.
                        </span>
                      </div>

                      <div className="text-right min-w-[110px]">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Preço Médio Ponderado
                        </span>
                        <span className="text-sm sm:text-base font-black font-mono text-slate-900 block">
                          {specItem.weightedAvgPrice.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
