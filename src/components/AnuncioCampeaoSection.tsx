import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Trophy,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Store,
  DollarSign,
  Package,
  Sparkles,
  Zap,
  ShoppingBag,
} from 'lucide-react'
import type { CollectorDeduplicatedAd } from '@/services/mlCollectorService'

interface AnuncioCampeaoSectionProps {
  championAd: CollectorDeduplicatedAd | null
  topAds: CollectorDeduplicatedAd[]
  searchTerm: string
  onOpenCollector?: () => void
  selectedSpecName?: string | null
  onClearSelectedSpec?: () => void
}

export function AnuncioCampeaoSection({
  championAd,
  topAds,
  searchTerm,
  onOpenCollector,
  selectedSpecName,
  onClearSelectedSpec,
}: AnuncioCampeaoSectionProps) {
  const [showAllSubsequent, setShowAllSubsequent] = useState(false)

  // Subsequentes (#2 em diante)
  const subsequentAds = topAds.filter(
    (ad) => !championAd || (ad.id !== championAd.id && ad.mlb_id !== championAd.mlb_id),
  )
  const displayedSubsequent = showAllSubsequent ? subsequentAds : subsequentAds.slice(0, 4)

  if (!championAd) {
    return (
      <Card className="border-slate-200 bg-white shadow-xs">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Badge className="bg-slate-900 text-amber-300 font-bold text-xs gap-1.5 px-2.5 py-0.5">
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  2. ANÚNCIO CAMPEÃO DE VENDAS
                </Badge>
                <span className="text-xs font-bold text-slate-700">&quot;{searchTerm}&quot;</span>
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Nenhum anúncio com vendas confirmadas registrado nesta busca
              </h3>
              <p className="text-xs text-slate-500 max-w-xl leading-relaxed">
                Para identificar o anúncio líder real com contadores públicos auditados, use o
                Coletor do Navegador nas páginas de busca do Mercado Livre.
              </p>
            </div>
            {onOpenCollector && (
              <Button
                size="sm"
                variant="outline"
                onClick={onOpenCollector}
                className="h-9 text-xs border-amber-300 text-amber-900 hover:bg-amber-50 font-bold gap-1.5 shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                Abrir Coletor do Navegador
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-amber-300 bg-white shadow-sm overflow-hidden">
      {/* Top Header */}
      <CardHeader className="pb-3 border-b border-amber-200/70 bg-gradient-to-r from-amber-500/15 via-amber-400/5 to-transparent">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs px-3 py-1 gap-1.5 shadow-2xs">
                <Trophy className="w-4 h-4 fill-slate-950 text-slate-950" />
                2. ANÚNCIO CAMPEÃO DO MERCADO LIVRE
              </Badge>
              {selectedSpecName ? (
                <div className="flex items-center gap-1.5 bg-amber-500/20 border border-amber-400 text-amber-950 px-2.5 py-0.5 rounded-md text-xs font-bold">
                  <span>{searchTerm || 'termo'}</span>
                  <span className="text-amber-600">›</span>
                  <span className="text-amber-950 font-black">{selectedSpecName}</span>
                  {onClearSelectedSpec && (
                    <button
                      type="button"
                      onClick={onClearSelectedSpec}
                      className="ml-1 text-amber-800 hover:text-black font-extrabold"
                      title="Voltar ao termo geral"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ) : (
                <Badge
                  variant="outline"
                  className="bg-white text-slate-700 border-slate-300 font-mono text-[10px]"
                >
                  Anúncio #1 Absoluto em Volume Real
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-600">
              {selectedSpecName
                ? `Anúncio líder específico da família "${selectedSpecName}" com maior volume auditado nesta especificação.`
                : 'O produto real que mais faturou e girou estoque nesta busca, com dados auditados diretamente da página.'}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {championAd.permalink && (
              <Button
                size="sm"
                className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold gap-1.5 shadow-2xs"
                asChild
              >
                <a href={championAd.permalink} target="_blank" rel="noopener noreferrer">
                  Ver Anúncio no ML
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-6">
        {/* CARD DESTAQUE #1 REAL */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-500/20 via-amber-400/10 to-transparent rounded-2xl border-2 border-amber-400 shadow-xs relative">
          <div className="absolute -top-3 left-4">
            <Badge className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs gap-1.5 px-3 py-0.5 shadow-sm">
              <Trophy className="w-3.5 h-3.5 fill-slate-950 text-slate-950" />
              TOP #1 EM VENDAS
            </Badge>
          </div>

          <div className="pt-2 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
            <div className="flex items-start gap-4 flex-1 min-w-0">
              {/* Imagem */}
              {championAd.thumbnail ? (
                <img
                  src={championAd.thumbnail}
                  alt={championAd.title}
                  className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-xl border border-amber-300 bg-white shrink-0 shadow-xs"
                />
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0">
                  <Trophy className="w-10 h-10 text-amber-600" />
                </div>
              )}

              {/* Informações Completas */}
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3
                    className="text-base sm:text-lg font-black text-slate-950 leading-snug"
                    title={championAd.title}
                  >
                    {championAd.title}
                  </h3>
                </div>

                <div className="flex items-center gap-2 flex-wrap pt-0.5">
                  {championAd.condition && (
                    <Badge
                      variant="outline"
                      className="text-[10px] capitalize bg-white/80 border-slate-300"
                    >
                      {championAd.condition}
                    </Badge>
                  )}
                  {championAd.is_full && (
                    <Badge className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 h-5 gap-1 shadow-2xs">
                      ⚡ Full
                    </Badge>
                  )}
                  {championAd.is_free_shipping && (
                    <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 text-[10px] font-semibold px-2 py-0.5 h-5">
                      Frete Grátis
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-600 font-mono flex-wrap pt-1">
                  {championAd.seller_name && (
                    <span className="flex items-center gap-1">
                      <Store className="w-3.5 h-3.5 text-slate-400" />
                      Vendedor: <strong className="text-slate-900">{championAd.seller_name}</strong>
                    </span>
                  )}
                  {championAd.mlb_id && (
                    <>
                      <span>·</span>
                      <span>
                        MLB: <strong>{championAd.mlb_id}</strong>
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Preço e Vendas Auditadas */}
            <div className="flex items-center gap-5 shrink-0 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-amber-200">
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">
                  Vendas Auditadas
                </span>
                <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-700 block">
                  {championAd.sold_quantity != null
                    ? championAd.sold_quantity.toLocaleString('pt-BR')
                    : '0'}{' '}
                  un.
                </span>
                <span className="text-[10px] text-emerald-800 font-semibold block">
                  confirmadas
                </span>
              </div>

              <div className="text-right border-l border-amber-200 pl-5">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">
                  Preço no Anúncio
                </span>
                <span className="text-2xl sm:text-3xl font-black font-mono text-slate-950 block">
                  {championAd.price?.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  }) || 'N/D'}
                </span>
                <span className="text-[10px] text-slate-400 font-mono block">
                  preço de prateleira
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* SUBSEQUENTES (#2 EM DIANTE): RANKING COMPACTO / EXPANSÍVEL */}
        {subsequentAds.length > 0 && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-slate-700" />
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wide">
                  Anúncios Subsequentes no Ranking (2º ao{' '}
                  {Math.min(
                    subsequentAds.length + 1,
                    showAllSubsequent ? subsequentAds.length + 1 : 5,
                  )}
                  º lugar)
                </h4>
                <Badge
                  variant="outline"
                  className="text-[10px] text-slate-600 bg-slate-50 border-slate-200"
                >
                  {subsequentAds.length} anúncios ranqueados
                </Badge>
              </div>

              {subsequentAds.length > 4 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllSubsequent(!showAllSubsequent)}
                  className="h-7 text-xs text-indigo-600 hover:text-indigo-800 font-semibold gap-1 px-2"
                >
                  {showAllSubsequent ? 'Recolher' : `Ver Todos (${subsequentAds.length})`}
                  {showAllSubsequent ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </Button>
              )}
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white divide-y divide-slate-100">
              {displayedSubsequent.map((ad, idx) => {
                const rank = idx + 2
                return (
                  <div
                    key={ad.id || idx}
                    className="p-3 sm:p-3.5 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
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
                          <h5
                            className="font-bold text-slate-900 text-sm truncate"
                            title={ad.title}
                          >
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
                              Seller: <strong className="text-slate-700">{ad.seller_name}</strong>
                            </span>
                          )}
                          {ad.mlb_id && (
                            <>
                              <span>·</span>
                              <span>MLB: {ad.mlb_id}</span>
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
                          {ad.sold_quantity != null
                            ? ad.sold_quantity.toLocaleString('pt-BR')
                            : '0'}{' '}
                          un.
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
        )}
      </CardContent>
    </Card>
  )
}
