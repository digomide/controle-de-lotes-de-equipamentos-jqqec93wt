import React, { useState, useMemo, useEffect } from 'react'
import {
  TrendingUp,
  Search,
  Sparkles,
  RefreshCw,
  Trophy,
  Package,
  Layers,
  Percent,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ArrowUpRight,
  ArrowRight,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Info,
  Store,
  DollarSign,
  Activity,
  Filter,
  ShieldCheck,
  Clock,
  Database,
  Users,
  Monitor,
  Target,
  Zap,
} from 'lucide-react'
import { CatalogPositionMonitor } from '@/components/CatalogPositionMonitor'
import { RawPositionsDrawer } from '@/components/RawPositionsDrawer'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'
import {
  mlCatalogService,
  formatMLSoldQuantity,
  type MLCatalogProduct,
} from '@/services/mlCatalogService'
import {
  aggregateSellersByExactProduct,
  recordAdSnapshots,
  type ExactProductSummary,
  type SellerPerformanceAggregate,
  type RaioXScopeMode,
} from '@/services/mlExactProductService'
import { type ExactProductSearchMode } from '@/lib/catalogFilter'
import {
  positionOverridesService,
  type PositionOverrideAction,
} from '@/services/positionOverridesService'
import { mlCollectorService, type CollectorSummaryReport } from '@/services/mlCollectorService'
import { mlCategoriesService } from '@/services/mlCategoriesService'
import { QualMaisVendeHero } from '@/components/QualMaisVendeHero'
import { AnuncioCampeaoSection } from '@/components/AnuncioCampeaoSection'
import { NumerosDoMercado } from '@/components/NumerosDoMercado'
import { PodioVendasCollector } from '@/components/PodioVendasCollector'
import { RankingCompletoEspecificacoes } from '@/components/RankingCompletoEspecificacoes'
import type { CollectorSpecMetrics } from '@/services/mlCollectorService'

interface RaioXMercadoTabProps {
  onOpenCollector?: (term?: string) => void
}

export function RaioXMercadoTab({ onOpenCollector }: RaioXMercadoTabProps = {}) {
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState('cooler lenovo m900')
  const [activeQuery, setActiveQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [progressText, setSearchProgressText] = useState('')
  const [stoppingJob, setStoppingJob] = useState(false)
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [isCached, setIsCached] = useState(false)
  const [cachedAt, setCachedAt] = useState<string | null>(null)
  const [rawProducts, setRawProducts] = useState<MLCatalogProduct[]>([])
  const [historicalSnapshots, setHistoricalSnapshots] = useState<any[]>([])
  const [showHowItWorks, setShowHowItWorks] = useState(false)
  const [snapshotSaved, setSnapshotSaved] = useState(false)
  const [savingSnapshot, setSavingSnapshot] = useState(false)
  const [selectedSellerDetail, setSelectedSellerDetail] =
    useState<SellerPerformanceAggregate | null>(null)
  const [showSellersDrawer, setShowSellersDrawer] = useState(false)
  const [showAllAdsDrawer, setShowAllAdsDrawer] = useState(false)
  const [showRawPositionsDrawer, setShowRawPositionsDrawer] = useState(false)
  const [showCatalogMonitor, setShowCatalogMonitor] = useState(false)
  const [adsListingFilter, setAdsListingFilter] = useState<'all' | 'premium' | 'classic'>('all')
  const [showMarketForceDetails, setShowMarketForceDetails] = useState(false)
  const [showTaxonomyScopeCard, setShowTaxonomyScopeCard] = useState(false)

  // Overrides manuais do usuário (MISSÃO 1)
  const [overrides, setOverrides] = useState<Record<string, PositionOverrideAction>>({})

  // Coleta do Navegador (Bypass WAF)
  const [collectorSalesMap, setCollectorSalesMap] = useState<Map<string, number>>(new Map())
  const [collectorMeta, setCollectorMeta] = useState<{
    importId: string
    importedAt: string
    itemsCount: number
    withSalesCount: number
    collectorSource?: string
  } | null>(null)
  const [collectorReport, setCollectorReport] = useState<CollectorSummaryReport | null>(null)
  const [loadingCollectorReport, setLoadingCollectorReport] = useState(false)
  const [selectedSpec, setSelectedSpec] = useState<CollectorSpecMetrics | null>(null)
  const [selectedSubfamily, setSelectedSubfamily] = useState<string | null>(null)

  // Controle de Escopo do Raio-X
  const [scopeMode, setScopeMode] = useState<RaioXScopeMode>('exact')
  const [manualBrain, setManualBrain] = useState<ExactProductSearchMode | null>(null)

  // Resetar seleção de especificação e sub-família sempre que o termo pesquisado mudar
  useEffect(() => {
    setSelectedSpec(null)
    setSelectedSubfamily(null)
  }, [activeQuery, searchTerm])

  // Função para rolar suavemente até o Ranking Completo
  function scrollToRanking() {
    const el = document.getElementById('ranking-completo-specs')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // Sugestões de produtos exatos para pesquisa rápida
  const suggestedExactProducts = [
    'cooler lenovo m900',
    'fonte desktop dell 3020',
    'dell latitude 5420 i5',
    'thinkpad t480',
    'iphone 17',
    'carregador dell 65w 4.5mm',
  ]

  // Carregar snapshots existentes do banco ao montar
  useEffect(() => {
    async function loadSnapshots() {
      try {
        const snaps = await pb.collection('ml_ad_snapshots').getList(1, 300, {
          sort: '-created',
        })
        if (snaps && snaps.items) {
          setHistoricalSnapshots(snaps.items)
        }
      } catch {
        /* intentionally ignored */
      }
    }
    loadSnapshots()
  }, [])

  // Carregar overrides e coletas do navegador quando a query ativa ou a busca inicial mudar
  useEffect(() => {
    const queryToUse = activeQuery || searchTerm.trim()
    if (!queryToUse) {
      setOverrides({})
      setCollectorSalesMap(new Map())
      setCollectorMeta(null)
      setCollectorReport(null)
      return
    }
    async function loadOverridesAndCollector() {
      try {
        const map = await positionOverridesService.getOverridesForTerm(queryToUse)
        setOverrides(map)
      } catch (err) {
        console.warn('Erro ao carregar overrides:', err)
      }

      try {
        const latestImport = await mlCollectorService.getLatestImportForTerm(queryToUse)
        if (latestImport && latestImport.payload?.results) {
          const sMap = new Map<string, number>()
          latestImport.payload.results.forEach((item) => {
            if (item.sold_quantity != null && item.sold_quantity > 0) {
              if (item.id) sMap.set(item.id, item.sold_quantity)
              if (item.mlb_id) sMap.set(item.mlb_id, item.sold_quantity)
            }
          })
          setCollectorSalesMap(sMap)
          setCollectorMeta({
            importId: latestImport.id,
            importedAt: latestImport.imported_at || latestImport.created || '',
            itemsCount: latestImport.results_count || latestImport.payload.results.length,
            withSalesCount: latestImport.with_sales_count || sMap.size,
            collectorSource: latestImport.notes || latestImport.payload.source || 'manual',
          })
        } else {
          setCollectorSalesMap(new Map())
          setCollectorMeta(null)
        }
      } catch (err) {
        console.warn('Erro ao carregar coletas do navegador:', err)
      }

      // Carregar relatório consolidado e deduplicado para o Pódio de Vendas
      try {
        setLoadingCollectorReport(true)
        const report = await mlCollectorService.getCollectorSummaryReport(queryToUse)
        if (report && report.ok && report.total_deduplicated_ads > 0) {
          setCollectorReport(report)
        } else {
          setCollectorReport(null)
        }
      } catch (err) {
        console.warn('Erro ao gerar relatório do Pódio de Vendas:', err)
        setCollectorReport(null)
      } finally {
        setLoadingCollectorReport(false)
      }
    }
    loadOverridesAndCollector()
  }, [activeQuery, searchTerm])

  // Interromper busca
  async function handleStop() {
    if (!currentJobId || stoppingJob) return
    setStoppingJob(true)
    try {
      await mlCatalogService.stopSearchJob(currentJobId)
      toast({
        title: 'Parando varredura...',
        description: 'Compilando os dados já minerados do produto exato.',
      })
    } catch (err) {
      console.warn('Erro ao parar job:', err)
    } finally {
      setTimeout(() => setStoppingJob(false), 1500)
    }
  }

  // Executar busca profunda de mercado
  async function runAnalysis(queryToUse?: string, forceRefresh = false) {
    const q = (queryToUse ?? searchTerm).trim()
    if (!q) {
      toast({
        title: 'Informe um produto exato',
        description: 'Ex.: "fonte desktop dell 3020", "dell latitude 5420 i5", "thinkpad t480"',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    setActiveQuery(q)
    setRawProducts([])
    setCurrentJobId(null)
    setIsCached(false)
    setCachedAt(null)
    setSnapshotSaved(false)
    setSelectedSellerDetail(null)
    setSearchProgressText(
      forceRefresh
        ? 'Varrendo o Mercado Livre em tempo real para o produto exato...'
        : 'Iniciando varredura profunda para "' + q + '"...',
    )

    try {
      const jobInit = await mlCatalogService.searchCatalog(q, '', 'all', forceRefresh)
      setCurrentJobId(jobInit.id)

      const jobDone = await mlCatalogService.pollSearchJob(jobInit.id, (j) => {
        if (j.progress_text) setSearchProgressText(j.progress_text)
        if (Array.isArray(j.results) && j.results.length > 0) {
          setRawProducts(j.results)
        }
      })

      if (jobDone.status === 'error') {
        throw new Error(jobDone.error_message || 'Falha ao buscar no catálogo')
      }

      const results = jobDone.results || []
      setRawProducts(results)

      if (jobDone.is_cached || jobDone.strategy_used?.includes('cached')) {
        setIsCached(true)
        setCachedAt(jobDone.cached_at || jobDone.created || null)
      }

      if (results.length === 0) {
        toast({
          title: 'Nenhum anúncio encontrado no Mercado Livre',
          description: 'Tente outro termo ou amplie a busca.',
        })
      } else {
        toast({
          title: `Varredura concluída: ${results.length} posições mineradas`,
          description: `Aplicando filtro de precisão de produto exato para "${q}".`,
        })
      }
    } catch (err: any) {
      console.error('Erro no Raio-X:', err)
      toast({
        title: 'Falha na varredura do produto',
        description: err?.message || 'Não foi possível carregar os dados do Mercado Livre.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
      setCurrentJobId(null)
    }
  }

  // Reset do cérebro manual quando a query de busca muda
  useEffect(() => {
    setManualBrain(null)
  }, [activeQuery])

  // Agregação dos dados por PRODUTO EXATO e por SELLER respeitando o modo de escopo, cérebro e overrides do usuário
  const summary: ExactProductSummary | null = useMemo(() => {
    if (!rawProducts || rawProducts.length === 0 || !activeQuery) return null
    return aggregateSellersByExactProduct(
      rawProducts,
      activeQuery,
      historicalSnapshots,
      scopeMode,
      manualBrain || undefined,
      overrides,
      collectorSalesMap.size > 0 ? collectorSalesMap : undefined,
      collectorMeta,
    )
  }, [
    rawProducts,
    activeQuery,
    historicalSnapshots,
    scopeMode,
    manualBrain,
    overrides,
    collectorSalesMap,
    collectorMeta,
  ])

  // Salvar snapshot periódico no banco (sempre usando os dados agregados do modo Produto Exato)
  async function handleSaveSnapshot() {
    if (!rawProducts || rawProducts.length === 0 || !activeQuery || savingSnapshot) return
    setSavingSnapshot(true)
    try {
      // Requisito 3: "os snapshots devem continuar gravando os dados agregados do modo Produto exato"
      const exactSummary =
        scopeMode === 'exact'
          ? summary
          : aggregateSellersByExactProduct(
              rawProducts,
              activeQuery,
              historicalSnapshots,
              'exact',
              manualBrain || undefined,
            )

      if (!exactSummary) {
        throw new Error('Nenhum dado do produto exato para gravar.')
      }

      const res = await recordAdSnapshots(exactSummary)
      setSnapshotSaved(true)
      toast({
        title: 'Snapshot de histórico registrado!',
        description: `${res.savedCount} anúncio(s) e preços do produto exato salvos para histórico de 60 dias.`,
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar snapshot',
        description: err?.message || 'Falha ao gravar no banco.',
        variant: 'destructive',
      })
    } finally {
      setSavingSnapshot(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Banner Superior com Explicação Transparente */}
      <Card className="border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white shadow-md">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-amber-400/20 text-amber-300 border border-amber-400/30 flex items-center justify-center shrink-0">
                  <Flame className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                    Raio-X de Mercado Global
                    <Badge className="bg-amber-400 text-slate-950 hover:bg-amber-300 text-[10px] font-bold">
                      Análise Global do Produto
                    </Badge>
                  </h2>
                  <p className="text-xs text-slate-300">
                    Consolida o universo completo de anúncios do produto exato no Mercado Livre:
                    força de mercado, estoque agregado, faixa de preços, liquidez, distribuição de
                    anúncios e oportunidade de margem.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHowItWorks(!showHowItWorks)}
                className="text-xs h-9 bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white gap-1.5"
              >
                <Info className="w-3.5 h-3.5" />
                Como funciona o Termômetro?
                {showHowItWorks ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </Button>
            </div>
          </div>

          {/* Explicação Expansível dos Critérios Transparentes */}
          {showHowItWorks && (
            <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-300">
              <div className="bg-slate-900/80 p-3.5 rounded-lg border border-slate-800 space-y-1.5">
                <span className="font-bold text-amber-300 flex items-center gap-1.5 text-xs">
                  <Filter className="w-3.5 h-3.5" /> 1. Filtro de Produto Exato
                </span>
                <p className="text-[11px] leading-relaxed text-slate-400">
                  Descarta automaticamente produtos genéricos, acessórios desconexos e modelos
                  diferentes. Ao buscar &quot;fonte desktop dell 3020&quot;, preserva apenas fontes
                  compatíveis com o Dell 3020.
                </p>
              </div>

              <div className="bg-slate-900/80 p-3.5 rounded-lg border border-slate-800 space-y-1.5">
                <span className="font-bold text-indigo-300 flex items-center gap-1.5 text-xs">
                  <TrendingUp className="w-3.5 h-3.5" /> 2. Métricas Globais Consolidadas
                </span>
                <p className="text-[11px] leading-relaxed text-slate-400">
                  Reúne todos os anúncios ativos legítimos do produto para mensurar a força real do
                  item no ML: estoque total visível, dispersão de preço (mín/méd/máx), volume de
                  vendedores e mix Premium vs Clássico.
                </p>
              </div>

              <div className="bg-slate-900/80 p-3.5 rounded-lg border border-slate-800 space-y-1.5">
                <span className="font-bold text-emerald-300 flex items-center gap-1.5 text-xs">
                  <Database className="w-3.5 h-3.5" /> 3. Honestidade e Snapshots
                </span>
                <p className="text-[11px] leading-relaxed text-slate-400">
                  Nunca inventamos números. Onde a API do ML bloqueia vendas de terceiros (403),
                  usamos os sinais reais auditáveis e gravamos snapshots no banco para medir deltas
                  reais de 60 dias conforme acumulamos histórico.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Barra de Entrada / Pesquisa */}
      <Card className="border-slate-200 shadow-xs bg-white">
        <CardContent className="p-4 sm:p-5">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              runAnalysis(searchTerm, false)
            }}
            className="space-y-3"
          >
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder="Pesquise o produto exato (ex.: fonte desktop dell 3020, thinkpad t480, latitude 5420)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-10 text-sm bg-slate-50 border-slate-200 focus:bg-white"
                  disabled={loading}
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="submit"
                  disabled={loading}
                  className="h-10 px-5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs gap-2 shadow-xs"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <TrendingUp className="w-4 h-4" />
                  )}
                  {loading ? 'Analisando Mercado...' : 'Analisar Mercado Global'}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => runAnalysis(searchTerm, true)}
                  disabled={loading}
                  className="h-10 px-3 text-xs border-slate-300 text-slate-700 hover:bg-slate-50 gap-1.5"
                  title="Forçar varredura ignorando o cache"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Atualizar
                </Button>

                {loading && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleStop}
                    disabled={stoppingJob}
                    className="h-10 px-3 text-xs bg-rose-600 hover:bg-rose-700 text-white"
                  >
                    {stoppingJob ? 'Parando...' : 'Parar'}
                  </Button>
                )}
              </div>
            </div>

            {/* Chips de produtos sugeridos para clique rápido */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                Sugestões de produtos:
              </span>
              {suggestedExactProducts.map((prod) => (
                <button
                  key={prod}
                  type="button"
                  onClick={() => {
                    setSearchTerm(prod)
                    runAnalysis(prod, false)
                  }}
                  className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 border border-slate-200 transition-colors"
                >
                  {prod}
                </button>
              ))}
            </div>

            {/* Status da busca ao vivo / cache */}
            {loading && (
              <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-lg flex items-center gap-3 text-xs text-indigo-900 animate-pulse">
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-600 shrink-0" />
                <span className="font-medium">
                  {progressText ||
                    'Varrendo posições e consultando concorrência no Mercado Livre...'}
                </span>
              </div>
            )}

            {!loading && isCached && cachedAt && (
              <div className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-1">
                <Badge variant="outline" className="bg-slate-50 text-slate-600 text-[10px] h-4">
                  Cache Ativo (15 min)
                </Badge>
                <span>
                  Resultados preservados da varredura realizada às {cachedAt.substring(11, 16)}.
                </span>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* NARRATIVA DE NEGÓCIO QUANDO HÁ COLETAS REAIS ANTES OU SEM O RESUMO DO CATÁLOGO ML */}
      {!summary && !loading && collectorReport && collectorReport.total_deduplicated_ads > 0 && (
        <div className="space-y-6">
          <div className="p-3 bg-amber-500/10 border border-amber-300 rounded-lg text-xs text-amber-900 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Exibindo narrativa com dados do <strong>Coletor de Vendas</strong> para &quot;
                {activeQuery || searchTerm}&quot; ({collectorReport.total_deduplicated_ads} anúncios
                úteis
                {collectorReport.noise_ads_count
                  ? `, ${collectorReport.noise_ads_count} ruídos excluídos`
                  : ''}
                ).
              </span>
            </div>
            <Button
              size="sm"
              onClick={() => runAnalysis(activeQuery || searchTerm, false)}
              className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white shrink-0 font-bold gap-1.5 shadow-xs"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Analisar Catálogo ML
            </Button>
          </div>

          {/* ALERTA DE RUÍDO DETECTADO SE HOUVER ITENS FILTRADOS */}
          {Boolean(collectorReport.noise_ads_count && collectorReport.noise_ads_count > 0) && (
            <div className="p-3 bg-slate-100 border border-slate-300 rounded-lg text-xs text-slate-700 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-amber-600 font-bold">🛡️ Filtro Anti-Ruído:</span>
                <span>
                  <strong>{collectorReport.noise_ads_count}</strong> anúncio(s) fora de contexto
                  (miniaturas, brinquedos, bicicletas ou excluídos manualmente) foram segregados das
                  métricas e do pódio.
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onOpenCollector && onOpenCollector(activeQuery || searchTerm)}
                className="h-7 text-xs bg-white text-slate-700 border-slate-300 hover:bg-slate-50 gap-1 font-semibold"
              >
                Gerenciar no Coletor
              </Button>
            </div>
          )}

          {/* 1. QUAL MAIS VENDE? (Herói do Topo) */}
          <QualMaisVendeHero
            report={collectorReport}
            searchTerm={activeQuery || searchTerm}
            onOpenCollector={() => onOpenCollector && onOpenCollector(activeQuery || searchTerm)}
            selectedSpecName={selectedSpec?.spec || null}
            onSelectSpec={(spec) => setSelectedSpec(spec)}
            onOpenFullRanking={scrollToRanking}
          />

          {/* 2. ANÚNCIO CAMPEÃO (Card Destaque) */}
          <AnuncioCampeaoSection
            championAd={selectedSpec ? selectedSpec.championAd : collectorReport.champion_ad}
            topAds={
              selectedSpec
                ? selectedSpec.ads.filter((a) => a.sold_quantity != null && a.sold_quantity > 0)
                : collectorReport.top_ads
            }
            searchTerm={activeQuery || searchTerm}
            onOpenCollector={() => onOpenCollector && onOpenCollector(activeQuery || searchTerm)}
            selectedSpecName={selectedSpec?.spec || null}
            onClearSelectedSpec={() => setSelectedSpec(null)}
          />

          {/* 3. NÚMEROS DO MERCADO (Cards de Síntese) */}
          <NumerosDoMercado
            collectorReport={collectorReport}
            catalogSummary={null}
            selectedSpec={selectedSpec}
            onClearSelectedSpec={() => setSelectedSpec(null)}
            searchTerm={activeQuery || searchTerm}
          />

          {/* 3.1 RANKING COMPLETO DE TODAS AS ESPECIFICAÇÕES */}
          <RankingCompletoEspecificacoes
            specs={collectorReport.all_specs || []}
            selectedSpecName={selectedSpec?.spec || null}
            onSelectSpec={(spec) => setSelectedSpec(spec)}
            totalSoldUnitsAll={collectorReport.total_sold_units || 0}
            searchTerm={activeQuery || searchTerm}
          />
        </div>
      )}

      {/* Estado Vazio (sem resumo e sem coleta do navegador) */}
      {!summary &&
        !loading &&
        (!collectorReport || collectorReport.total_deduplicated_ads === 0) && (
          <Card className="border-dashed border-slate-300 shadow-none bg-slate-50/60">
            <CardContent className="p-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto">
                <Flame className="w-6 h-6 text-amber-500" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">
                Nenhuma análise de produto exato carregada
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Digite acima o produto desejado (ex.: &quot;fonte desktop dell 3020&quot;). O
                sistema fará a busca no ML, aplicará o filtro de similaridade rigorosa e montará o{' '}
                <strong>Termômetro de Vendas por Seller</strong>. Se houver coletas salvas do
                Coletor do Navegador, o <strong>Pódio de Vendas</strong> aparecerá em destaque.
              </p>
            </CardContent>
          </Card>
        )}

      {/* CONTEÚDO PRINCIPAL: NARRATIVA DE NEGÓCIO REORGANIZADA + GAVETA DE ANÚNCIOS + DISPUTA POR SELLERS */}
      {summary && (
        <div className="space-y-6">
          {/* BARRA SUPERIOR DE AÇÕES & ESCOPO DO RAIO-X */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-indigo-600" /> Escopo:
              </span>
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setScopeMode('exact')}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                    scopeMode === 'exact'
                      ? 'bg-white text-indigo-700 shadow-2xs border border-indigo-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  🎯 Produto Exato
                </button>
                <button
                  type="button"
                  onClick={() => setScopeMode('all_mentions')}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                    scopeMode === 'all_mentions'
                      ? 'bg-white text-indigo-700 shadow-2xs border border-indigo-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  📦 Tudo que Cita
                </button>
                <button
                  type="button"
                  onClick={() => setScopeMode('own_only')}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                    scopeMode === 'own_only'
                      ? 'bg-white text-indigo-700 shadow-2xs border border-indigo-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  👤 Meus Anúncios
                </button>
              </div>

              {scopeMode === 'exact' && (
                <Badge
                  variant="outline"
                  className={`text-[10px] font-semibold gap-1 ${
                    summary.activeBrain === 'part'
                      ? 'bg-amber-50 text-amber-900 border-amber-300'
                      : 'bg-blue-50 text-blue-900 border-blue-300'
                  }`}
                >
                  {summary.activeBrain === 'part' ? '⚙️ Peça' : '📱 Produto Inteiro'}
                </Badge>
              )}
            </div>

            {/* BOTÕES DE ACESSO PERMANENTE: POSIÇÕES BRUTAS (N) E ANÚNCIOS */}
            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-end">
              <Button
                size="sm"
                onClick={() => setShowRawPositionsDrawer(!showRawPositionsDrawer)}
                className={`text-xs h-8 font-bold gap-1.5 shadow-2xs ${
                  showRawPositionsDrawer
                    ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 ring-2 ring-amber-300'
                    : 'bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-400/40'
                }`}
                title="Abrir gaveta com TODAS as posições brutas mineradas da busca para auditar e vincular"
              >
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                {showRawPositionsDrawer
                  ? `Recolher Posições Brutas (${summary.totalRawPositions})`
                  : `Posições Brutas (${summary.totalRawPositions})`}
                {showRawPositionsDrawer ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAllAdsDrawer(!showAllAdsDrawer)}
                className="text-xs h-8 bg-white border-slate-300 text-slate-700 hover:bg-slate-50 gap-1.5"
              >
                <Package className="w-3.5 h-3.5 text-blue-600" />
                {showAllAdsDrawer ? 'Ocultar Anúncios' : `Anúncios (${summary.allAds.length})`}
                {showAllAdsDrawer ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </Button>

              {onOpenCollector && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onOpenCollector(activeQuery || searchTerm)}
                  className={`text-xs h-8 font-semibold gap-1.5 ${
                    summary.collectorSource
                      ? 'border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100'
                      : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                  title="Abrir Coletor do Navegador"
                >
                  <Activity className="w-3.5 h-3.5 text-emerald-600" />
                  {summary.collectorSource
                    ? `Coletor (${summary.collectorSource.withSalesCount} vendas)`
                    : 'Coletor'}
                </Button>
              )}

              <Button
                size="sm"
                variant="ghost"
                onClick={handleSaveSnapshot}
                disabled={savingSnapshot || snapshotSaved}
                className="text-xs h-8 text-indigo-700 hover:bg-indigo-50 gap-1"
                title="Gravar foto atual para histórico"
              >
                <Database className="w-3 h-3 text-indigo-600" />
                {snapshotSaved ? '✓ Salvo' : savingSnapshot ? '...' : 'Snapshot'}
              </Button>
            </div>
          </div>

          {/* =========================================================================
              NARRATIVA DE NEGÓCIO DO RAIO-X (ORDEM E PRIORIDADE REQUISITADAS)
             ========================================================================= */}

          {/* 1. "QUAL MAIS VENDE?" (Herói do Topo) */}
          <QualMaisVendeHero
            report={collectorReport}
            searchTerm={summary.searchTerm}
            onOpenCollector={() => onOpenCollector && onOpenCollector(activeQuery || searchTerm)}
            selectedSpecName={selectedSpec?.spec || null}
            onSelectSpec={(spec) => setSelectedSpec(spec)}
            onOpenFullRanking={scrollToRanking}
          />

          {/* 2. "ANÚNCIO CAMPEÃO" (Card Destaque Real: Coletor PREVALECE sobre catálogo) */}
          <AnuncioCampeaoSection
            championAd={
              selectedSpec
                ? selectedSpec.championAd
                : collectorReport?.champion_ad ||
                  (summary.allAds.length > 0 &&
                  summary.allAds.some((a) => a.soldQuantity != null && a.soldQuantity > 0)
                    ? (() => {
                        const sortedBySales = [...summary.allAds]
                          .filter((a) => a.soldQuantity != null && a.soldQuantity > 0)
                          .sort((a, b) => (b.soldQuantity || 0) - (a.soldQuantity || 0))
                        const lead = sortedBySales[0]
                        if (!lead) return null
                        return {
                          id: lead.id,
                          mlb_id: lead.id,
                          title: lead.title,
                          price: lead.price,
                          sold_quantity: lead.soldQuantity || 0,
                          thumbnail: lead.thumbnail,
                          seller_name: lead.sellerNickname,
                          permalink: lead.permalink,
                          condition: lead.listingTypeLabel,
                          is_full: false,
                          is_free_shipping: false,
                        }
                      })()
                    : null)
            }
            topAds={
              selectedSpec
                ? selectedSpec.ads.filter((a) => a.sold_quantity != null && a.sold_quantity > 0)
                : collectorReport?.top_ads && collectorReport.top_ads.length > 0
                  ? collectorReport.top_ads
                  : summary.allAds
                      .filter((a) => a.soldQuantity != null && a.soldQuantity > 0)
                      .sort((a, b) => (b.soldQuantity || 0) - (a.soldQuantity || 0))
                      .slice(0, 10)
                      .map((ad) => ({
                        id: ad.id,
                        mlb_id: ad.id,
                        title: ad.title,
                        price: ad.price,
                        sold_quantity: ad.soldQuantity || 0,
                        thumbnail: ad.thumbnail,
                        seller_name: ad.sellerNickname,
                        permalink: ad.permalink,
                        condition: ad.listingTypeLabel,
                        is_full: false,
                        is_free_shipping: false,
                      }))
            }
            searchTerm={summary.searchTerm}
            onOpenCollector={() => onOpenCollector && onOpenCollector(activeQuery || searchTerm)}
            selectedSpecName={selectedSpec?.spec || null}
            onClearSelectedSpec={() => setSelectedSpec(null)}
          />

          {/* 3. "NÚMEROS DO MERCADO" (Cards de Síntese) */}
          <NumerosDoMercado
            collectorReport={collectorReport}
            catalogSummary={summary}
            selectedSpec={selectedSpec}
            onClearSelectedSpec={() => setSelectedSpec(null)}
            searchTerm={summary.searchTerm}
          />

          {/* 3.1 RANKING COMPLETO DE TODAS AS ESPECIFICAÇÕES */}
          {collectorReport && collectorReport.all_specs && collectorReport.all_specs.length > 0 && (
            <RankingCompletoEspecificacoes
              specs={collectorReport.all_specs}
              selectedSpecName={selectedSpec?.spec || null}
              onSelectSpec={(spec) => setSelectedSpec(spec)}
              totalSoldUnitsAll={collectorReport.total_sold_units || 0}
              searchTerm={summary.searchTerm}
            />
          )}

          {/* 4. "OPORTUNIDADE DE MARGEM & ÂNCORA DE PREÇO" (Card Aprovado pelo Usuário - Mantido na Íntegra) */}
          <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50/70 via-white to-amber-50/30 shadow-sm overflow-hidden">
            <CardHeader className="pb-3 border-b border-emerald-100 bg-gradient-to-r from-emerald-500/10 via-amber-500/5 to-transparent">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs sm:text-sm font-bold uppercase text-emerald-950 tracking-wider flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-emerald-600" />
                  4. Oportunidade de Margem & Âncora de Preço
                </span>
                {summary.bestOpportunityMargin && (
                  <div className="flex items-center gap-1.5">
                    <Badge
                      className={`text-[10px] font-bold px-2 py-0.5 ${
                        summary.bestOpportunityMargin.opportunityTier === 'high'
                          ? 'bg-emerald-600 text-white'
                          : summary.bestOpportunityMargin.opportunityTier === 'intense'
                            ? 'bg-amber-600 text-white'
                            : 'bg-blue-600 text-white'
                      }`}
                    >
                      {summary.bestOpportunityMargin.opportunityTier === 'high'
                        ? '🎯 Oportunidade Alta'
                        : summary.bestOpportunityMargin.opportunityTier === 'intense'
                          ? '⚡ Disputa Intensa'
                          : '❄️ Mercado Frio'}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="text-[10px] font-mono font-bold bg-white text-slate-700 border-slate-300"
                    >
                      Score: {summary.bestOpportunityMargin.opportunityScore}/100
                    </Badge>
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-6 space-y-4">
              {summary.bestOpportunityMargin ? (
                <div className="space-y-4">
                  {/* Grade Principal: Âncora de Preço vs Faixa de Entrada Sugerida */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Coluna 1: Âncora de Preço ("O mercado paga R$ X") */}
                    <div className="p-4 bg-white/95 rounded-xl border border-emerald-200 shadow-2xs space-y-2">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1">
                          <DollarSign className="w-3.5 h-3.5 text-emerald-600" /> O mercado paga
                          (Âncora)
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1.5 py-0 h-4 bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold"
                        >
                          {summary.bestOpportunityMargin.anchorSource === 'buy_box_leader'
                            ? 'Líder Buy Box'
                            : summary.bestOpportunityMargin.anchorSource ===
                                'confirmed_sales_median'
                              ? 'Mediana Vendas'
                              : 'Referência'}
                        </Badge>
                      </div>

                      <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl font-black font-mono text-emerald-950">
                          {summary.bestOpportunityMargin.anchorPrice.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 leading-tight">
                        Origem:{' '}
                        <strong>{summary.bestOpportunityMargin.anchorSellerNickname}</strong> (quem
                        realmente tem relevância e vende).
                      </p>
                    </div>

                    {/* Coluna 2: Faixa de Entrada Sugerida ("Entre com R$ Y-Z") */}
                    <div className="p-4 bg-white/95 rounded-xl border border-amber-300 shadow-2xs space-y-2">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-bold uppercase text-amber-900 flex items-center gap-1">
                          <Zap className="w-3.5 h-3.5 text-amber-600" /> Entre com (Preço Saudável)
                        </span>
                        <Badge className="bg-amber-100 text-amber-900 text-[9px] px-1.5 py-0 h-4 border-amber-300 font-bold">
                          Margem: {summary.bestOpportunityMargin.marginPercentMin}% a{' '}
                          {summary.bestOpportunityMargin.marginPercentMax}%
                        </Badge>
                      </div>

                      <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl font-black font-mono text-amber-950">
                          {summary.bestOpportunityMargin.suggestedEntryMin.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </span>
                        <span className="text-sm text-amber-700 font-bold">a</span>
                        <span className="text-2xl font-black font-mono text-amber-900">
                          {summary.bestOpportunityMargin.suggestedEntryMax.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </span>
                      </div>

                      <p className="text-xs text-amber-900 leading-tight">
                        Logo abaixo da âncora (R$ {summary.bestOpportunityMargin.marginAmountMin} a
                        R$ {summary.bestOpportunityMargin.marginAmountMax} de margem),{' '}
                        <strong>sem cair no piso</strong>.
                      </p>
                    </div>
                  </div>

                  {/* Chips de Transparência dos Componentes da Nota (como faz o Termômetro) */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                      Pilares do Score:
                    </span>
                    <span
                      className="text-[10px] bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-700 flex items-center gap-1 shadow-2xs"
                      title="Poucos vendedores no produto exato abrem espaço de preço livre"
                    >
                      <Users className="w-3 h-3 text-purple-600" />
                      Concorrência:{' '}
                      <strong>
                        {summary.bestOpportunityMargin.scoreComponents.competitionScore}/35 pts
                      </strong>
                    </span>
                    <span
                      className="text-[10px] bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-700 flex items-center gap-1 shadow-2xs"
                      title="Estoque total ralo frente à demanda aparente"
                    >
                      <Package className="w-3 h-3 text-blue-600" />
                      Estoque Ralo:{' '}
                      <strong>
                        {summary.bestOpportunityMargin.scoreComponents.stockPressureScore}/35 pts
                      </strong>
                    </span>
                    <span
                      className="text-[10px] bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-700 flex items-center gap-1 shadow-2xs"
                      title="Âncora de preço com espaço de margem comprovada"
                    >
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      Espaço de Margem:{' '}
                      <strong>
                        {summary.bestOpportunityMargin.scoreComponents.marginSpaceScore}/30 pts
                      </strong>
                    </span>
                    {summary.bestOpportunityMargin.scoreComponents.demandScore !== undefined && (
                      <span
                        className="text-[10px] bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-300 text-emerald-900 flex items-center gap-1 shadow-2xs font-bold"
                        title="Bônus por vendas reais confirmadas via Coletor do Navegador"
                      >
                        <Activity className="w-3 h-3 text-emerald-600" />
                        Demanda Real (Coletor):{' '}
                        <strong>
                          +{summary.bestOpportunityMargin.scoreComponents.demandScore} pts
                        </strong>
                      </span>
                    )}
                  </div>

                  {/* Explicação da Regra de Ouro */}
                  <p className="text-xs text-slate-700 leading-relaxed bg-white/80 p-3 rounded-lg border border-slate-200">
                    {summary.bestOpportunityMargin.explanation}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  Dados de margem sob consulta ou pouca dispersão de preço observada.
                </p>
              )}

              {/* Rodapé do Card com Regra de Ouro / Filosofia */}
              <div className="pt-3 border-t border-slate-200/80 text-xs text-slate-600 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    <strong>Regra de Ouro:</strong> Baixa concorrência é multiplicador de margem.
                    Não corte preço para acompanhar anúncios sem relevância.
                  </span>
                </div>

                {summary.priceMin > 0 &&
                  summary.bestOpportunityMargin &&
                  summary.priceMin < summary.bestOpportunityMargin.suggestedEntryMin && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      Piso informativo descartado: R${' '}
                      {summary.priceMin.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  )}
              </div>
            </CardContent>
          </Card>

          {/* =========================================================================
              5. SEÇÕES SECUNDÁRIAS ORGANIZADAS (COLAPSÁVEIS / EXPANSÍVEIS)
             ========================================================================= */}

          {/* Card Destaque: Posição de Catálogo do ML (se existente) */}
          {summary.catalogPosition && (
            <div className="p-4 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent rounded-lg border border-amber-300 dark:border-amber-800 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge className="bg-amber-600 hover:bg-amber-700 text-white gap-1 px-2 py-0.5 text-xs font-semibold">
                    <Store className="h-3.5 w-3.5" />🏪 Posição de Catálogo do ML
                  </Badge>
                  {summary.catalogPosition.catalogProductId && (
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {summary.catalogPosition.catalogProductId}
                    </Badge>
                  )}
                  <Badge variant="secondary" className="text-[10px]">
                    {summary.catalogPosition.totalAdsCount} anúncio(s) concorrendo
                  </Badge>
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  {summary.catalogPosition.title}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Página unificada do Mercado Livre agregando{' '}
                  {summary.catalogPosition.distinctSellersCount} sellers.
                  {summary.catalogPosition.buyBoxWinner
                    ? ` Vencedor atual da Buy Box: ${summary.catalogPosition.buyBoxWinner.sellerNickname} a R$ ${summary.catalogPosition.buyBoxWinner.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`
                    : ''}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  onClick={() => setShowCatalogMonitor(!showCatalogMonitor)}
                  className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium gap-1.5 shadow-xs"
                >
                  <Monitor className="h-3.5 w-3.5" />
                  {showCatalogMonitor ? 'Recolher Monitor' : 'Abrir Monitor do Catálogo'}
                </Button>
                {summary.catalogPosition.permalink && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1 border-amber-300"
                    asChild
                  >
                    <a
                      href={summary.catalogPosition.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Ver no ML
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* SEÇÃO EXPANDIDA DO MONITOR DA POSIÇÃO DE CATÁLOGO */}
          {summary.catalogPosition && showCatalogMonitor && (
            <div className="pt-1">
              <CatalogPositionMonitor catalogPosition={summary.catalogPosition} />
            </div>
          )}

          {/* SEÇÃO COLAPSÁVEL: DETALHES DE FORÇA DO MERCADO & TAXONOMIA */}
          <Card className="border-slate-200 bg-white shadow-2xs">
            <CardHeader
              className="py-3 px-4 flex flex-row items-center justify-between cursor-pointer hover:bg-slate-50/60 transition-colors select-none"
              onClick={() => setShowMarketForceDetails(!showMarketForceDetails)}
            >
              <div className="flex items-center gap-2.5">
                <Flame className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Indicadores Técnicos de Força & Taxonomia do Termo
                </span>
                <Badge variant="outline" className="text-[10px] text-slate-600">
                  Score ML: {summary.marketForceScore}/100
                </Badge>
              </div>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400">
                {showMarketForceDetails ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </Button>
            </CardHeader>

            {showMarketForceDetails && (
              <CardContent className="p-4 pt-1 border-t border-slate-100 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">
                      Classificação de Força
                    </span>
                    <span className="text-base font-bold text-slate-900 block mt-0.5">
                      {summary.marketForceTier === 'strong'
                        ? '🔥 Forte / Alta Demanda'
                        : summary.marketForceTier === 'moderate'
                          ? '🌡️ Demanda Moderada'
                          : '❄️ Nicho / Disputa Baixa'}
                    </span>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {summary.marketForceExplanation}
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">
                      Filtro Taxonômico
                    </span>
                    <span className="text-base font-bold text-slate-900 block mt-0.5">
                      {summary.exactMatchedPositionsCount} de {summary.totalRawPositions}{' '}
                      compatíveis
                    </span>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {summary.filteredOutCount} produto(s) descartados por ruído ou
                      incompatibilidade.
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">
                      Mix Premium / Clássico
                    </span>
                    <span className="text-base font-bold text-slate-900 block mt-0.5 font-mono">
                      {summary.distribution.premiumPercent}% Prem. /{' '}
                      {summary.distribution.classicPercent}% Cláss.
                    </span>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {summary.distribution.premiumCount} anúncios Premium e{' '}
                      {summary.distribution.classicCount} Clássicos.
                    </p>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* MISSÃO 1: PAINEL DE POSIÇÕES BRUTAS ("GAVETA DAS 1.043") */}
          {showRawPositionsDrawer && (
            <RawPositionsDrawer
              searchTerm={summary.searchTerm}
              rawProducts={rawProducts}
              activeBrain={summary.activeBrain}
              overrides={overrides}
              onOverrideChange={async (updated) => {
                setOverrides(updated)
                const termToRefresh = activeQuery || searchTerm || summary?.searchTerm || ''
                if (collectorReport) {
                  const refreshed = mlCollectorService.filterAndRecalculateReport(
                    collectorReport,
                    termToRefresh,
                    updated,
                  )
                  setCollectorReport(refreshed)
                }
              }}
            />
          )}

          {/* GAVETA GLOBAL 1: TODOS OS ANÚNCIOS DO PRODUTO EXATO */}
          {showAllAdsDrawer && (
            <Card className="border-slate-200 shadow-sm bg-white">
              <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                    <Package className="w-4 h-4 text-blue-600" />
                    Universo de Anúncios do Produto Exato ({summary.allAds.length} anúncios ativos)
                  </CardTitle>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Lista completa de anúncios catalogados para este modelo no Mercado Livre.
                  </p>
                </div>

                {/* Filtro por tipo de anúncio */}
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant={adsListingFilter === 'all' ? 'default' : 'outline'}
                    onClick={() => setAdsListingFilter('all')}
                    className="h-7 text-xs px-2.5"
                  >
                    Todos ({summary.allAds.length})
                  </Button>
                  <Button
                    size="sm"
                    variant={adsListingFilter === 'premium' ? 'default' : 'outline'}
                    onClick={() => setAdsListingFilter('premium')}
                    className="h-7 text-xs px-2.5"
                  >
                    Premium ({summary.distribution.premiumCount})
                  </Button>
                  <Button
                    size="sm"
                    variant={adsListingFilter === 'classic' ? 'default' : 'outline'}
                    onClick={() => setAdsListingFilter('classic')}
                    className="h-7 text-xs px-2.5"
                  >
                    Clássico ({summary.distribution.classicCount})
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                  {summary.allAds
                    .filter((ad) => {
                      if (adsListingFilter === 'premium') return ad.listingTypeLabel === 'Premium'
                      if (adsListingFilter === 'classic') return ad.listingTypeLabel !== 'Premium'
                      return true
                    })
                    .map((ad, idx) => (
                      <div
                        key={ad.id || idx}
                        className="p-3.5 hover:bg-slate-50/70 transition-colors flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {ad.thumbnail ? (
                            <img
                              src={ad.thumbnail}
                              alt={ad.title}
                              className="w-11 h-11 object-cover rounded border border-slate-200 shrink-0"
                            />
                          ) : (
                            <Package className="w-11 h-11 text-slate-300 shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h5 className="font-bold text-slate-900 truncate" title={ad.title}>
                                {ad.title}
                              </h5>
                              {ad.isBuyBoxWinner && (
                                <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[9px] font-bold px-1.5 py-0 h-4">
                                  Detém Buy Box
                                </Badge>
                              )}
                              {ad.isOwnAccount && (
                                <Badge className="bg-indigo-600 text-white text-[9px] font-bold px-1.5 py-0 h-4">
                                  Sua Conta
                                </Badge>
                              )}
                              {ad.isKitOrBundle && (
                                <Badge
                                  variant="outline"
                                  className="bg-amber-50 text-amber-800 border-amber-300 text-[9px] font-bold px-1.5 py-0 h-4"
                                >
                                  📦 Kit / Lote
                                </Badge>
                              )}
                              {ad.isFamilyMatch && (
                                <Badge
                                  variant="outline"
                                  className="bg-cyan-50 text-cyan-800 border-cyan-300 text-[9px] font-bold px-1.5 py-0 h-4"
                                  title={
                                    ad.matchedFamilyName
                                      ? `Compatível com a família ${ad.matchedFamilyName}`
                                      : 'Casamento por família compatível'
                                  }
                                >
                                  ⚡ Casamento por Família
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2.5 text-[11px] text-slate-500 font-mono flex-wrap pt-0.5">
                              <span>
                                Vendedor: <strong>{ad.sellerNickname}</strong>
                              </span>
                              <span>·</span>
                              <span>ID: {ad.id}</span>
                              <span>·</span>
                              <span
                                className={
                                  ad.listingTypeLabel === 'Premium'
                                    ? 'text-emerald-700 font-semibold'
                                    : 'text-slate-600'
                                }
                              >
                                Tipo: {ad.listingTypeLabel}
                              </span>
                              <span>·</span>
                              <span>Estoque: {ad.stock} un.</span>
                              {ad.soldQuantity != null && (
                                <>
                                  <span>·</span>
                                  <span className="text-emerald-700 font-bold">
                                    Vendas: {formatMLSoldQuantity(ad.soldQuantity)}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-sm font-black font-mono text-slate-900">
                            {ad.price.toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </span>

                          {ad.permalink && (
                            <a
                              href={ad.permalink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600"
                              title="Abrir no Mercado Livre"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* GAVETA SECUNDÁRIA: DISPUTA POR SELLERS & TERMÔMETRO DE GIRO */}
          <Card className="border-slate-200 shadow-xs bg-white">
            <CardHeader
              className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 cursor-pointer select-none"
              onClick={() => setShowSellersDrawer(!showSellersDrawer)}
            >
              <div>
                <CardTitle className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-500" />
                  Disputa por Vendedor & Termômetro de Vendas ({summary.sellersRanked.length}{' '}
                  vendedores ranqueados)
                  <Badge variant="outline" className="text-[10px] text-slate-600 ml-1">
                    Seção Secundária
                  </Badge>
                </CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Visualização detalhada por loja concorrente: ranqueamento de força (0-100), Buy
                  Box e estoque por seller.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 hidden sm:flex">
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] font-bold">
                    🔥 Giro Alto (65–100)
                  </Badge>
                  <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px] font-bold">
                    🌡️ Médio (35–64)
                  </Badge>
                  <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-[10px] font-bold">
                    ❄️ Baixo (0–34)
                  </Badge>
                </div>
                <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-slate-600 gap-1">
                  {showSellersDrawer ? 'Recolher Sellers' : 'Expandir Sellers'}
                  {showSellersDrawer ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </CardHeader>

            {showSellersDrawer && (
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {summary.sellersRanked.map((seller, sIdx) => {
                    const isTopSeller = sIdx === 0
                    const isOwn = seller.isOwnAccount
                    const hasSales = seller.hasRealSalesData && seller.totalConfirmedSales > 0

                    return (
                      <div
                        key={seller.sellerId || sIdx}
                        className={`p-4 transition-colors hover:bg-slate-50/70 ${
                          isOwn ? 'bg-indigo-50/30' : ''
                        }`}
                      >
                        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                          {/* Identificação do Seller + Badges */}
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            {/* Posição no ranking */}
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 mt-0.5 ${
                                sIdx === 0
                                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                                  : sIdx === 1
                                    ? 'bg-slate-300 text-slate-800'
                                    : sIdx === 2
                                      ? 'bg-amber-700 text-white'
                                      : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              #{sIdx + 1}
                            </div>

                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-sm font-bold text-slate-900 truncate flex items-center gap-1.5">
                                  <Store className="w-3.5 h-3.5 text-slate-400" />
                                  {seller.sellerNickname}
                                </h4>

                                {isOwn && (
                                  <Badge className="bg-indigo-600 text-white text-[9px] font-bold px-1.5 py-0 h-4">
                                    🏅 Sua Conta
                                  </Badge>
                                )}

                                {seller.hasBuyBox && (
                                  <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[9px] font-bold gap-1 px-1.5 py-0 h-4">
                                    <Trophy className="w-2.5 h-2.5 text-amber-600" />
                                    Detém Buy Box
                                  </Badge>
                                )}

                                <Badge
                                  variant="outline"
                                  className="text-[9px] text-slate-600 bg-slate-50 border-slate-200"
                                >
                                  {seller.totalAdsCount} anúncio(s) do produto
                                </Badge>

                                {seller.premiumListingsCount > 0 && (
                                  <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[9px] font-semibold px-1.5 py-0 h-4">
                                    Premium (S/ Juros)
                                  </Badge>
                                )}
                              </div>

                              {/* Detalhes de Preço e Estoque */}
                              <div className="flex items-center gap-3 text-xs text-slate-600 font-mono flex-wrap pt-0.5">
                                <span>
                                  Faixa:{' '}
                                  <strong>
                                    {seller.minPrice.toLocaleString('pt-BR', {
                                      style: 'currency',
                                      currency: 'BRL',
                                    })}
                                  </strong>
                                  {seller.maxPrice > seller.minPrice
                                    ? ` a ${seller.maxPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                                    : ''}
                                </span>
                                <span>·</span>
                                <span>
                                  Estoque somado: <strong>{seller.totalAvailableStock} un.</strong>
                                </span>
                                <span>·</span>
                                <span>
                                  Vendas auditadas:{' '}
                                  {hasSales ? (
                                    <strong className="text-emerald-700 font-bold">
                                      {seller.totalConfirmedSales} un.
                                    </strong>
                                  ) : (
                                    <span className="text-slate-400">Não informado pelo ML</span>
                                  )}
                                </span>
                              </div>

                              {/* Motivos que compõem o termômetro */}
                              <div className="pt-1 flex items-center gap-1.5 flex-wrap">
                                {seller.thermometerReasons.map((reason, rIdx) => (
                                  <span
                                    key={rIdx}
                                    className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200"
                                  >
                                    {reason}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Termômetro Visual e Ações */}
                          <div className="flex items-center justify-between lg:justify-end gap-4 w-full lg:w-auto shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                            {/* Termômetro Score */}
                            <div className="text-right min-w-[140px]">
                              <div className="flex items-center justify-end gap-1.5">
                                <span className="text-[10px] font-bold uppercase text-slate-400">
                                  Termômetro de Vendas
                                </span>
                                {seller.thermometerTier === 'high' ? (
                                  <span className="text-xs font-bold text-emerald-700 flex items-center gap-0.5">
                                    <Flame className="w-3.5 h-3.5 text-emerald-600" /> Giro Alto
                                  </span>
                                ) : seller.thermometerTier === 'medium' ? (
                                  <span className="text-xs font-bold text-amber-700 flex items-center gap-0.5">
                                    🌡️ Médio
                                  </span>
                                ) : (
                                  <span className="text-xs font-bold text-blue-700 flex items-center gap-0.5">
                                    ❄️ Baixo
                                  </span>
                                )}
                              </div>

                              <div className="flex items-baseline justify-end gap-1 mt-0.5">
                                <span className="text-2xl font-black font-mono text-slate-900">
                                  {seller.thermometerScore}
                                </span>
                                <span className="text-xs font-semibold text-slate-400 font-mono">
                                  / 100
                                </span>
                              </div>

                              {/* Mini Barra do Termômetro */}
                              <div className="w-32 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200 ml-auto mt-1">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    seller.thermometerTier === 'high'
                                      ? 'bg-emerald-600'
                                      : seller.thermometerTier === 'medium'
                                        ? 'bg-amber-500'
                                        : 'bg-blue-500'
                                  }`}
                                  style={{ width: `${Math.max(5, seller.thermometerScore)}%` }}
                                />
                              </div>
                            </div>

                            {/* Botão Ver Anúncios do Seller */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedSellerDetail(
                                  selectedSellerDetail?.sellerId === seller.sellerId
                                    ? null
                                    : seller,
                                )
                              }}
                              className="text-xs h-9 border-slate-300 text-slate-700 hover:bg-slate-50 gap-1 shrink-0"
                            >
                              {selectedSellerDetail?.sellerId === seller.sellerId
                                ? 'Recolher'
                                : 'Ver Anúncios'}
                              {selectedSellerDetail?.sellerId === seller.sellerId ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </Button>
                          </div>
                        </div>

                        {/* Gaveta de Anúncios deste Seller */}
                        {selectedSellerDetail?.sellerId === seller.sellerId && (
                          <div className="mt-4 pt-4 border-t border-slate-200 bg-slate-50/80 rounded-lg p-3 space-y-2">
                            <span className="text-xs font-bold text-slate-800 block">
                              Anúncios do vendedor para este produto ({seller.ads.length}):
                            </span>
                            <div className="space-y-2">
                              {seller.ads.map((ad, aIdx) => (
                                <div
                                  key={ad.id || aIdx}
                                  className="bg-white p-3 rounded-md border border-slate-200 flex items-center justify-between gap-3 text-xs"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    {ad.thumbnail ? (
                                      <img
                                        src={ad.thumbnail}
                                        alt={ad.title}
                                        className="w-10 h-10 object-cover rounded border border-slate-200 shrink-0"
                                      />
                                    ) : (
                                      <Package className="w-10 h-10 text-slate-300 shrink-0" />
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <h5
                                          className="font-bold text-slate-900 truncate"
                                          title={ad.title}
                                        >
                                          {ad.title}
                                        </h5>
                                        {ad.isKitOrBundle && (
                                          <Badge
                                            variant="outline"
                                            className="bg-amber-50 text-amber-800 border-amber-300 text-[9px] font-bold px-1.5 py-0 h-4"
                                          >
                                            📦 Kit / Lote
                                          </Badge>
                                        )}
                                        {ad.isFamilyMatch && (
                                          <Badge
                                            variant="outline"
                                            className="bg-cyan-50 text-cyan-800 border-cyan-300 text-[9px] font-bold px-1.5 py-0 h-4"
                                            title={
                                              ad.matchedFamilyName
                                                ? `Compatível com a família ${ad.matchedFamilyName}`
                                                : 'Casamento por família compatível'
                                            }
                                          >
                                            ⚡ Casamento por Família
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono flex-wrap">
                                        <span>ID: {ad.id}</span>
                                        <span>·</span>
                                        <span>Tipo: {ad.listingTypeLabel}</span>
                                        <span>·</span>
                                        <span>Estoque: {ad.stock} un.</span>
                                        {ad.soldQuantity != null && (
                                          <>
                                            <span>·</span>
                                            <span className="text-emerald-700 font-bold">
                                              Vendas: {formatMLSoldQuantity(ad.soldQuantity)}
                                            </span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-3 shrink-0">
                                    <span className="text-sm font-black font-mono text-slate-900">
                                      {ad.price.toLocaleString('pt-BR', {
                                        style: 'currency',
                                        currency: 'BRL',
                                      })}
                                    </span>

                                    {ad.permalink && (
                                      <a
                                        href={ad.permalink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1.5 rounded bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600"
                                        title="Abrir no Mercado Livre"
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                      </a>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
