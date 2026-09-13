import React, { useState } from 'react'
import {
  Lightbulb,
  Wand2,
  CheckCircle2,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  History,
  Layers,
  ArrowRight,
  Package,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/use-toast'
import {
  mlQuestionsService,
  type MLQuestionMetrics,
  type MLQuestionInsightProduct,
  type MLInsightCorrectionProposal,
} from '@/services/mlQuestionsService'
import { MLInsightCorrectionModal } from './MLInsightCorrectionModal'

interface MLQuestionsInsightsPanelProps {
  metrics: MLQuestionMetrics | null
  onRefresh?: () => void
  compact?: boolean
}

export function MLQuestionsInsightsPanel({
  metrics,
  onRefresh,
  compact = false,
}: MLQuestionsInsightsPanelProps) {
  const [selectedProposal, setSelectedProposal] = useState<MLInsightCorrectionProposal | null>(null)
  const [loadingProposal, setLoadingProposal] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  // Controle de expansão de texto ("Ver mais" / "Ver menos") por anúncio
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({})

  const toggleExpand = (itemId: string) => {
    setExpandedItems((prev) => ({ ...prev, [itemId]: !prev[itemId] }))
  }

  // Dispara a geração da proposta de correção com 1 clique para um anúncio
  const handleOpenCorrection = async (item: MLQuestionInsightProduct) => {
    if (!item.item_id || item.item_id === 'MLB-Geral') {
      toast({
        variant: 'destructive',
        title: 'Anúncio não mapeado',
        description: 'Esta pergunta não possui um ID de anúncio do Mercado Livre vinculado.',
      })
      return
    }

    setModalOpen(true)
    setLoadingProposal(true)
    setSelectedProposal(null)

    try {
      const prop = await mlQuestionsService.getInsightCorrectionProposal(item.item_id)
      setSelectedProposal(prop)
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao gerar proposta',
        description: err?.message || 'Falha ao buscar detalhes do anúncio no Mercado Livre.',
      })
      setModalOpen(false)
    } finally {
      setLoadingProposal(false)
    }
  }

  const allProducts = metrics?.top_products_with_questions || []
  // Insights pendentes de correção (anúncios que ainda não foram corrigidos e têm dúvidas)
  const pendingInsights = allProducts.filter((p) => !p.is_corrected && p.total_questions > 0)
  // Anúncios já corrigidos
  const correctedInsights = allProducts.filter((p) => p.is_corrected)

  if (allProducts.length === 0) {
    return null
  }

  // MODO COMPACTO: Ideal para banner na página /anuncios-ml
  if (compact) {
    if (pendingInsights.length === 0) {
      return null
    }

    const topPending = pendingInsights[0]

    const isTopExpanded = !!expandedItems[topPending.item_id]
    const topProposedText = topPending.proposed_text || ''

    return (
      <>
        <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-yellow-500/15 border-2 border-amber-500/30 rounded-xl p-4 shadow-sm space-y-3">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-start gap-3 flex-1">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-700 shrink-0 mt-0.5 border border-amber-500/30">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-amber-950 dark:text-amber-100 flex items-center gap-1.5">
                    Insight com Correção de 1 Clique
                  </span>
                  <Badge className="bg-amber-500 text-slate-950 font-bold text-[10px]">
                    {pendingInsights.length} anúncio(s) com dúvidas recorrentes
                  </Badge>
                  {topPending.is_corrected && (
                    <Badge
                      variant="outline"
                      className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 text-[10px] font-bold"
                    >
                      ✅ Já corrigido anteriormente
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-amber-900/90 dark:text-amber-200 leading-relaxed">
                  O anúncio <strong className="font-semibold">"{topPending.item_title}"</strong>{' '}
                  <span className="font-mono text-[11px] text-amber-800 dark:text-amber-300">
                    ({topPending.item_id})
                  </span>{' '}
                  recebeu {topPending.total_questions} dúvidas frequentes:
                </p>
                {topPending.sample_texts && topPending.sample_texts.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {topPending.sample_texts.slice(0, 2).map((t, i) => (
                      <span
                        key={i}
                        className="text-[11px] bg-background/80 border border-amber-500/20 px-2 py-0.5 rounded text-amber-950 dark:text-amber-100 italic"
                      >
                        "{t}"
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
              {topPending.item_permalink && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(topPending.item_permalink, '_blank')}
                  className="text-xs h-9 px-3 gap-1 border-amber-500/30 hover:bg-amber-500/10"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Ver no ML
                </Button>
              )}
              <Button
                onClick={() => handleOpenCorrection(topPending)}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs h-9 px-4 gap-1.5 shadow-sm w-full md:w-auto"
              >
                <Wand2 className="h-4 w-4" />
                Corrigir com 1 Clique
              </Button>
            </div>
          </div>

          {/* Bloco com o texto de correção sugerido para leitura prévia imediata */}
          {topProposedText && (
            <div className="bg-background/90 border border-amber-500/30 rounded-lg p-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                  Correção sugerida pronta para anexar:
                </span>
                <button
                  type="button"
                  onClick={() => toggleExpand(topPending.item_id)}
                  className="text-amber-700 dark:text-amber-300 hover:underline text-[11px] font-semibold flex items-center gap-0.5"
                >
                  {isTopExpanded ? (
                    <>
                      Ver menos <ChevronUp className="h-3 w-3" />
                    </>
                  ) : (
                    <>
                      Ver texto completo <ChevronDown className="h-3 w-3" />
                    </>
                  )}
                </button>
              </div>

              <div
                className={`text-[11px] font-mono leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap bg-amber-500/5 p-2 rounded border border-amber-500/20 ${
                  isTopExpanded ? '' : 'line-clamp-3'
                }`}
              >
                {topProposedText}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Este texto será anexado ao final da descrição do anúncio no Mercado Livre
                preservando todo o conteúdo original.
              </p>
            </div>
          )}
        </div>

        <MLInsightCorrectionModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          proposal={selectedProposal}
          loadingProposal={loadingProposal}
          onSuccess={() => {
            onRefresh?.()
          }}
        />
      </>
    )
  }

  // MODO COMPLETO: Painel de Insights na aba Perguntas ML
  return (
    <>
      <Card className="border shadow-sm">
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 border border-amber-500/20">
                <Lightbulb className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <span>Painel de Insights: Correção de 1 Clique nos Anúncios</span>
                  <Badge variant="outline" className="text-xs font-normal">
                    {pendingInsights.length} pendentes • {correctedInsights.length} corrigidos
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  O sistema agrupa as dúvidas recebidas por anúncio e sintetiza o parágrafo exato
                  que falta na descrição, permitindo atualizar a descrição no Mercado Livre com um
                  único clique.
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          {/* Seção 1: Pendentes de Correção */}
          {pendingInsights.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  Sugestões de Correção Pendentes ({pendingInsights.length})
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Clique no botão para abrir prévia lado a lado
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pendingInsights.map((item) => {
                  const isExpanded = !!expandedItems[item.item_id]
                  const proposed = item.proposed_text || ''

                  return (
                    <div
                      key={item.item_id}
                      className="border-2 border-amber-500/30 bg-amber-500/5 rounded-xl p-3.5 flex flex-col justify-between gap-3 hover:border-amber-500/60 transition-all shadow-xs"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="outline" className="font-mono text-[10px]">
                              {item.item_id}
                            </Badge>
                            {item.is_corrected && (
                              <Badge
                                variant="outline"
                                className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 text-[10px] font-bold"
                              >
                                ✅ Corrigido
                                {item.last_correction?.applied_at &&
                                  ` em ${new Date(item.last_correction.applied_at).toLocaleDateString('pt-BR')}`}
                              </Badge>
                            )}
                          </div>
                          <Badge className="bg-amber-600 text-white font-bold text-[10px]">
                            {item.total_questions} dúvidas recebidas
                          </Badge>
                        </div>

                        <h4 className="text-xs font-bold text-foreground line-clamp-2">
                          {item.item_title}
                        </h4>

                        {/* Bloco 1: Perguntas Recorrentes */}
                        {item.sample_texts && item.sample_texts.length > 0 && (
                          <div className="text-[11px] text-muted-foreground bg-background/80 p-2 rounded-lg border space-y-1">
                            <span className="font-semibold text-amber-950 dark:text-amber-200 block text-[10px]">
                              Perguntas recorrentes:
                            </span>
                            <div className="space-y-0.5">
                              {item.sample_texts.slice(0, 3).map((t, i) => (
                                <p key={i} className="italic truncate text-[11px]">
                                  "{t}"
                                </p>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Bloco 2: Correção Sugerida Visível com Ver Mais / Ver Menos */}
                        {proposed ? (
                          <div className="text-[11px] bg-background border border-amber-500/30 p-2.5 rounded-lg space-y-1.5 shadow-2xs">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-amber-950 dark:text-amber-200 flex items-center gap-1 text-[10px] uppercase tracking-wider">
                                <Sparkles className="h-3 w-3 text-amber-600" /> Correção sugerida:
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleExpand(item.item_id)}
                                className="text-amber-700 dark:text-amber-300 hover:underline text-[10px] font-semibold flex items-center gap-0.5"
                              >
                                {isExpanded ? (
                                  <>
                                    Recolher <ChevronUp className="h-2.5 w-2.5" />
                                  </>
                                ) : (
                                  <>
                                    Ler tudo <ChevronDown className="h-2.5 w-2.5" />
                                  </>
                                )}
                              </button>
                            </div>

                            <div
                              className={`text-[11px] font-mono leading-relaxed text-foreground whitespace-pre-wrap bg-amber-500/5 p-2 rounded border border-amber-500/15 ${
                                isExpanded ? '' : 'line-clamp-3'
                              }`}
                            >
                              {proposed}
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-amber-500/20">
                        {item.item_permalink ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-[11px] text-muted-foreground hover:text-foreground p-0 gap-1"
                            onClick={() => window.open(item.item_permalink, '_blank')}
                          >
                            <ExternalLink className="h-3 w-3" /> Ver no ML
                          </Button>
                        ) : (
                          <span />
                        )}

                        <Button
                          size="sm"
                          onClick={() => handleOpenCorrection(item)}
                          className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs h-8 px-3 gap-1.5 shadow-xs"
                        >
                          <Wand2 className="h-3.5 w-3.5" />
                          {item.is_corrected ? 'Atualizar com 1 Clique' : 'Corrigir com 1 Clique'}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center space-y-1">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 mx-auto" />
              <p className="text-xs font-bold text-emerald-800 dark:text-emerald-200">
                Todos os anúncios com dúvidas recorrentes estão corrigidos!
              </p>
              <p className="text-[11px] text-muted-foreground">
                As descrições dos anúncios no Mercado Livre já contam com as respostas antecipadas.
              </p>
            </div>
          )}

          {/* Seção 2: Corrigidos Recentemente */}
          {correctedInsights.length > 0 && (
            <div className="space-y-2 pt-2 border-t">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Corrigidos Recentemente ({correctedInsights.length})
              </span>

              <div className="divide-y border rounded-xl overflow-hidden bg-card text-xs">
                {correctedInsights.map((c) => (
                  <div
                    key={c.item_id}
                    className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-muted/30 transition-colors"
                  >
                    <div className="space-y-1.5 flex-1 pr-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground line-clamp-1">
                          {c.item_title}
                        </span>
                        <Badge
                          variant="outline"
                          className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 text-[10px] font-bold"
                        >
                          ✅ Corrigido
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        MLB: <span className="font-mono">{c.item_id}</span> •{' '}
                        {c.last_correction?.applied_at
                          ? `Atualizado em ${new Date(c.last_correction.applied_at).toLocaleString('pt-BR')}`
                          : 'Descrição atualizada com sucesso'}
                      </p>
                      {c.last_correction?.proposed_text && (
                        <div className="text-[10px] font-mono bg-muted/50 p-1.5 rounded border text-muted-foreground line-clamp-2">
                          <span className="font-sans font-bold text-foreground">
                            Texto aplicado:{' '}
                          </span>
                          {c.last_correction.proposed_text}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {c.item_permalink && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => window.open(c.item_permalink, '_blank')}
                        >
                          <ExternalLink className="h-3 w-3" /> Ver Anúncio
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => handleOpenCorrection(c)}
                      >
                        <Wand2 className="h-3 w-3" /> Atualizar Novamente
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal com Preview lado a lado */}
      <MLInsightCorrectionModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        proposal={selectedProposal}
        loadingProposal={loadingProposal}
        onSuccess={() => {
          onRefresh?.()
        }}
      />
    </>
  )
}
