import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Trophy,
  Flame,
  TrendingUp,
  DollarSign,
  Activity,
  Layers,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Cpu,
  Package,
  ShoppingBag,
  Sparkles,
} from 'lucide-react'
import type { CollectorSummaryReport } from '@/services/mlCollectorService'

interface PodioVendasCollectorProps {
  report: CollectorSummaryReport
  onOpenCollector?: () => void
}

export function PodioVendasCollector({ report, onOpenCollector }: PodioVendasCollectorProps) {
  const [showAllTopAds, setShowAllTopAds] = useState(false)
  const [showAllSpecs, setShowAllSpecs] = useState(false)
  const [activeAdTab, setActiveAdTab] = useState<'sales' | 'all'>('sales')

  const champion = report.champion_ad
  const nextTopAds = report.top_ads.slice(1)
  const displayedAds = showAllTopAds ? nextTopAds : nextTopAds.slice(0, 4)
  const displayedSpecs = showAllSpecs ? report.top_specs : report.top_specs.slice(0, 5)

  return (
    <Card className="border-amber-200/80 bg-gradient-to-br from-amber-50/60 via-white to-orange-50/30 shadow-sm overflow-hidden">
      {/* Top Banner do Pódio */}
      <CardHeader className="pb-3 border-b border-amber-200/60 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-transparent">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold px-2 py-0.5 gap-1 shadow-2xs">
                <Trophy className="w-3 h-3 text-amber-200" />
                Pódio de Vendas Reais
              </Badge>
              <Badge
                variant="outline"
                className="bg-white/80 text-amber-900 border-amber-300 font-mono text-[10px]"
              >
                {report.imports_count} coleta(s) unificadas · {report.total_deduplicated_ads}{' '}
                anúncios deduplicados
              </Badge>
              <Badge className="bg-emerald-600 text-white text-[10px] font-semibold">
                Auditado via Coletor do Navegador
              </Badge>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <span>Ranking Real de Vendas:</span>
              <span className="text-amber-800 font-extrabold">&quot;{report.term}&quot;</span>
            </h3>
            <p className="text-xs text-slate-600">
              Dados públicos minerados da busca pública do ML, deduplicados por ID único (mantendo o
              maior volume observado por página).
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onOpenCollector && (
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenCollector}
                className="h-8 text-xs bg-white border-amber-300 text-amber-900 hover:bg-amber-50 gap-1.5 font-semibold"
              >
                <Activity className="w-3.5 h-3.5 text-amber-600" />
                Histórico de Coletas
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-6">
        {/* BLOCO 1: CARDS SÍNTESE DE PREÇO & VENDAS (MÉDIA PONDERADA, SIMPLES, MEDIANA) */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Preço Médio Ponderado por Vendas */}
          <div className="p-3.5 bg-gradient-to-br from-emerald-500/15 via-emerald-50/50 to-white rounded-xl border-2 border-emerald-400 shadow-2xs space-y-1 col-span-2 sm:col-span-1">
            <span className="text-[10px] font-bold uppercase text-emerald-800 flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" /> Preço Médio de Venda
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-black font-mono text-emerald-950">
                {(report.weighted_avg_price || 0).toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Badge className="bg-emerald-600 text-white text-[9px] px-1.5 py-0 h-4 font-bold">
                Ponderado
              </Badge>
              <span className="text-[10px] text-emerald-800 font-semibold leading-tight">
                (Total R$ / Unidades)
              </span>
            </div>
            <p className="text-[10px] text-slate-600 leading-tight pt-1">
              Preço real que o cliente efetivamente paga pelas unidades vendidas.
            </p>
          </div>
          {/* Média Simples vs Mediana dos Anúncios com Vendas */}
          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-indigo-500" /> Média Simples
            </span>
            <span className="text-xl font-black font-mono text-slate-900 block mt-0.5">
              {(report.simple_avg_price || 0).toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })}
            </span>
            <span className="text-[11px] text-slate-600 font-mono block">
              Mediana:{' '}
              <strong className="text-slate-900">
                {(report.median_price || 0).toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </strong>
            </span>
            <span className="text-[10px] text-slate-400 block leading-tight">
              Calculada sobre {report.ads_with_sales_count} anúncios c/ venda
            </span>
          </div>
          {/* Total de Unidades Vendidas */}
          <div className="p-3.5 bg-white rounded-xl border border-amber-200 shadow-2xs space-y-1">
            <span className="text-[10px] font-bold uppercase text-amber-800 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-amber-500" /> Volume Vendido
            </span>
            <span className="text-2xl font-black font-mono text-amber-700 block mt-0.5">
              {(report.total_sold_units || 0).toLocaleString('pt-BR')} un.
            </span>
            <span className="text-[10px] text-slate-500 block">Soma auditada das vendas</span>
            <span className="text-[10px] text-emerald-700 font-bold block">
              {report.ads_with_sales_count} anúncios c/ vendas
            </span>
          </div>
          {/* Faixa de Preço dos que Vendem */}
          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
            <span className="text-[10px] font-bold uppercase text-purple-900 flex items-center gap-1">
              <ShoppingBag className="w-3.5 h-3.5 text-purple-600" /> Faixa de Preço (Vendas)
            </span>
            <span className="text-lg font-black font-mono text-purple-950 block mt-0.5">
              {(report.min_price || 0).toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })}
            </span>
            <span className="text-[10px] text-slate-600 font-mono block">
              Até{' '}
              {(report.max_price || 0).toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })}
            </span>
            <span className="text-[10px] text-slate-400 block">Piso ao teto de quem vende</span>
          </div>
          {/* Anúncios Sem Vendas Expostas */}
          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
              <Layers className="w-3 h-3 text-blue-500" /> Anúncios Ativos
            </span>
            <span className="text-2xl font-black font-mono text-slate-900 block mt-0.5">
              {report.total_deduplicated_ads}
            </span>
            <span className="text-[10px] text-emerald-700 font-bold block">
              {report.ads_with_sales_count} com vendas (
              {Math.round(
                (report.ads_with_sales_count / Math.max(1, report.total_deduplicated_ads)) * 100,
              )}
              %)
            </span>
            <span className="text-[10px] text-slate-400 block">
              {report.total_deduplicated_ads - report.ads_with_sales_count} sem vendas expostas
            </span>
          </div>
        </div>

        {/* BLOCO 2: DESTAQUE DO ANÚNCIO CAMPEÃO (O MAIS VENDIDO) */}
        {champion ? (
          <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-500/20 via-amber-400/10 to-transparent rounded-xl border-2 border-amber-400/80 shadow-xs relative">
            <div className="absolute -top-3 left-4">
              <Badge className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs gap-1.5 px-3 py-1 shadow-sm">
                <Trophy className="w-4 h-4 fill-slate-950 text-slate-950" />🏆 CAMPEÃO DE VENDAS
              </Badge>
            </div>

            <div className="pt-2 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5 flex-1 min-w-0">
                {champion.thumbnail ? (
                  <img
                    src={champion.thumbnail}
                    alt={champion.title}
                    className="w-16 h-16 object-cover rounded-lg border border-amber-300 bg-white shrink-0 shadow-2xs"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0">
                    <Trophy className="w-8 h-8 text-amber-600" />
                  </div>
                )}

                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-base font-extrabold text-slate-950 leading-snug">
                      {champion.title}
                    </h4>
                    {champion.condition && (
                      <Badge variant="outline" className="text-[10px] capitalize bg-white/70">
                        {champion.condition}
                      </Badge>
                    )}
                    {champion.is_full && (
                      <Badge className="bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0 h-4">
                        ⚡ Full
                      </Badge>
                    )}
                    {champion.is_free_shipping && (
                      <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 text-[9px] font-semibold px-1.5 py-0 h-4">
                        Frete Grátis
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-600 font-mono flex-wrap pt-0.5">
                    {champion.seller_name && (
                      <span>
                        Vendedor: <strong className="text-slate-900">{champion.seller_name}</strong>
                      </span>
                    )}
                    {champion.mlb_id && (
                      <>
                        <span>·</span>
                        <span>ID: {champion.mlb_id}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Preço e Vendas do Campeão */}
              <div className="flex items-center gap-4 shrink-0 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-amber-200">
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">
                    Vendas Confirmadas
                  </span>
                  <span className="text-2xl font-black font-mono text-emerald-700 block">
                    {champion.sold_quantity?.toLocaleString('pt-BR')} un.
                  </span>
                </div>

                <div className="text-right border-l border-amber-200 pl-4">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">
                    Preço no Anúncio
                  </span>
                  <span className="text-2xl font-black font-mono text-slate-950 block">
                    {champion.price?.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    }) || 'N/D'}
                  </span>
                </div>

                {champion.permalink && (
                  <Button
                    size="sm"
                    className="h-10 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold gap-1.5 shadow-2xs"
                    asChild
                  >
                    <a href={champion.permalink} target="_blank" rel="noopener noreferrer">
                      Ver no ML
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {/* BLOCO 3: AGRUPAMENTO POR ESPECIFICAÇÃO (QUAL ESPECIFICAÇÃO MAIS VENDE) */}
        {report.top_specs && report.top_specs.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-indigo-600" />
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  Especificações que Mais Vendem (Top Categorias / Modelos)
                </h4>
                <Badge
                  variant="outline"
                  className="text-[10px] text-indigo-800 bg-indigo-50 border-indigo-200"
                >
                  Agrupamento Taxonômico
                </Badge>
              </div>

              {report.top_specs.length > 5 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllSpecs(!showAllSpecs)}
                  className="h-7 text-xs text-indigo-600 hover:text-indigo-800 gap-1 px-2"
                >
                  {showAllSpecs ? 'Ver Menos' : `Ver Todas (${report.top_specs.length})`}
                  {showAllSpecs ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {displayedSpecs.map((specItem, idx) => {
                const percentOfTotal =
                  report.total_sold_units > 0
                    ? Math.round((specItem.totalUnits / report.total_sold_units) * 100)
                    : 0

                return (
                  <div
                    key={specItem.spec || idx}
                    className={`p-3.5 rounded-xl border transition-all ${
                      idx === 0
                        ? 'bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-white border-amber-300 shadow-2xs'
                        : 'bg-white border-slate-200 hover:border-indigo-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-6 h-6 rounded-md flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                            idx === 0
                              ? 'bg-amber-400 text-slate-950'
                              : idx === 1
                                ? 'bg-slate-300 text-slate-800'
                                : idx === 2
                                  ? 'bg-amber-700 text-white'
                                  : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          #{idx + 1}
                        </span>
                        <h5
                          className="font-bold text-slate-900 text-sm truncate"
                          title={specItem.spec}
                        >
                          {specItem.spec}
                        </h5>
                      </div>

                      {idx === 0 && (
                        <Badge className="bg-amber-500 text-slate-950 text-[9px] font-black px-1.5 py-0 h-4">
                          Top #1
                        </Badge>
                      )}
                    </div>

                    <div className="mt-3 flex items-baseline justify-between gap-2">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                          Unidades Vendidas
                        </span>
                        <span className="text-xl font-black font-mono text-emerald-700">
                          {specItem.totalUnits.toLocaleString('pt-BR')} un.
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                          Preço Médio Ponderado
                        </span>
                        <span className="text-base font-black font-mono text-slate-900">
                          {specItem.weightedAvgPrice.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Barra de participação */}
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                      <span>{specItem.adCount} anúncio(s) distintos</span>
                      <span className="font-bold text-slate-700 font-mono">
                        {percentOfTotal}% do total
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* BLOCO 4: OS SUBSEQUENTES (RANKING COMPLETO DOS MAIS VENDIDOS) */}
        <div className="space-y-3 pt-2">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-emerald-600" />
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Os Subsequentes Mais Vendidos ({report.top_ads.length} posições ranqueadas)
              </h4>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAllTopAds(!showAllTopAds)}
                className="h-8 text-xs gap-1 border-slate-300"
              >
                {showAllTopAds ? 'Recolher Lista' : `Ver Mais Anúncios (${nextTopAds.length})`}
                {showAllTopAds ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </Button>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white divide-y divide-slate-100">
            {displayedAds.map((ad, idx) => {
              const rank = idx + 2 // #1 é o campeão
              return (
                <div
                  key={ad.id || idx}
                  className="p-3.5 sm:p-4 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Rank Badge */}
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                        rank === 2
                          ? 'bg-slate-300 text-slate-800'
                          : rank === 3
                            ? 'bg-amber-700 text-white'
                            : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      #{rank}
                    </div>

                    {ad.thumbnail ? (
                      <img
                        src={ad.thumbnail}
                        alt={ad.title}
                        className="w-11 h-11 object-cover rounded-md border border-slate-200 shrink-0 bg-white"
                      />
                    ) : (
                      <Package className="w-11 h-11 text-slate-300 shrink-0" />
                    )}

                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h5 className="font-bold text-slate-900 text-sm truncate" title={ad.title}>
                          {ad.title}
                        </h5>
                        {ad.condition && (
                          <Badge variant="outline" className="text-[9px] capitalize">
                            {ad.condition}
                          </Badge>
                        )}
                        {ad.is_full && (
                          <Badge className="bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0 h-4">
                            ⚡ Full
                          </Badge>
                        )}
                        {ad.is_free_shipping && (
                          <Badge className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[9px] font-semibold px-1.5 py-0 h-4">
                            Frete Grátis
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2.5 text-[11px] text-slate-500 font-mono flex-wrap">
                        {ad.seller_name && (
                          <span>
                            Vendedor: <strong className="text-slate-700">{ad.seller_name}</strong>
                          </span>
                        )}
                        {ad.mlb_id && (
                          <>
                            <span>·</span>
                            <span>ID: {ad.mlb_id}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Vendas, Preço e Link */}
                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 w-full sm:w-auto border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Vendas
                      </span>
                      <span className="text-base font-black font-mono text-emerald-700 block">
                        {ad.sold_quantity?.toLocaleString('pt-BR')} un.
                      </span>
                    </div>

                    <div className="text-right min-w-[90px]">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Preço
                      </span>
                      <span className="text-base font-black font-mono text-slate-900 block">
                        {ad.price?.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        }) || 'N/D'}
                      </span>
                    </div>

                    {ad.permalink && (
                      <a
                        href={ad.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg bg-slate-100 hover:bg-amber-50 hover:text-amber-700 text-slate-600 transition-colors"
                        title="Ver anúncio no Mercado Livre"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
